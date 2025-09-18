extends PathFollow2D
signal died(reward:int)
signal escaped

# 적 타입 설정
var enemy_type := "":
	set(val):
		enemy_type = val
		_set_enemy_sprite(val)

# 적 상태 관리
enum State {walking, damaged}
var state = State.walking

# 기본 속성
@export var max_hp: float = 40.0
@export var base_speed: float = 1.0          # 이동 속도 배율 (슬로우 등에 곱해짐)
@export var speed_px_per_sec: float = 10.0   # 경로를 따라 이동하는 기본 속도(픽셀/초)
@export var reward: float = 10.0
@export var base_damage: float = 5.0

# 애니메이션 설정
@export var anim_name := "run"
@export var fps := 12.0

var hp: float
var speed: float
var is_destroyed := false

var sprite: AnimatedSprite2D
@onready var spawner = get_parent()

# 적 이미지는 enemies.json에서 sprite_path로 설정됨

# 경로 길이 캐시
var _path_len := 0.0
# 스프라이트 프레임 캐시(같은 스트립 재사용 시 비용 절감)
var _frames_cache: Dictionary = {} # key: texture_path(String) -> SpriteFrames

func _ready() -> void:
	hp = max_hp
	speed = base_speed
	add_to_group("enemy")
	
	# sprite 노드 찾기
	sprite = get_node("AnimatedSprite2D")

	# Path2D 길이 캐싱
	var p := get_parent()
	if p is Path2D and p.curve:
		_path_len = p.curve.get_baked_length()
	else:
		push_warning("Enemy should be child of a Path2D with a valid Curve2D.")

	# 스프라이트는 init_from_config에서 설정됨

func _set_enemy_sprite(t: String) -> void:
	if not sprite:
		return
	# 백업용 기본 스프라이트 (타입별 기본 이미지)
	var sprite_path := ""
	match t:
		"dino1":
			sprite_path = "res://assets/enemies/dino1.png"
		"dino2":
			sprite_path = "res://assets/enemies/dino2.png"
		"dino3":
			sprite_path = "res://assets/enemies/dino3.png"
		"dino4":
			sprite_path = "res://assets/enemies/dino4.png"
		_:
			sprite_path = "res://assets/enemies/dino1.png"  # 기본값

	if sprite_path != "":
		_setup_animation(sprite_path)

func _setup_animation(sprite_strip_path: String) -> void:
	if not sprite:
		return
	
	# 캐시 먼저
	if _frames_cache.has(sprite_strip_path):
		sprite.sprite_frames = _frames_cache[sprite_strip_path]
		sprite.animation = anim_name
		sprite.play()
		return

	var tex := load(sprite_strip_path) as Texture2D
	if not tex:
		push_warning("스프라이트 이미지 로드 실패: %s" % sprite_strip_path)
		return

	var frame_size := tex.get_height()                 # 한 프레임 높이(정사각 가정)
	var frame_count := int(tex.get_width() / float(frame_size))

	var frames := SpriteFrames.new()
	frames.add_animation(anim_name)
	frames.set_animation_speed(anim_name, fps)

	for i in range(frame_count):
		var atlas := AtlasTexture.new()
		atlas.atlas = tex
		atlas.region = Rect2(i * frame_size, 0, frame_size, frame_size)
		frames.add_frame(anim_name, atlas)

	_frames_cache[sprite_strip_path] = frames

	sprite.sprite_frames = frames
	sprite.animation = anim_name
	sprite.play()

func _process(delta: float) -> void:
	if state != State.walking or is_destroyed:
		return

	# 경로 이동: progress는 "픽셀" 단위
	if _path_len > 0.0:
		progress += speed_px_per_sec * speed * delta
		if progress >= _path_len:
			finished_path()
			return
	else:
		# 경로 길이를 모르더라도 최소한 진행은 하되, ratio가 1 넘으면 처리
		progress_ratio += (speed_px_per_sec * speed * delta) / 1000.0
		if progress_ratio >= 1.0:
			finished_path()
			return

	# 바라보는 방향에 따라 좌우 반전(왼쪽 향하면 flip_h = true)
	# PathFollow2D의 rotation이 진행 방향을 나타냄
	if sprite:
		sprite.flip_h = cos(rotation) < 0.0

func finished_path():
	if is_destroyed:
		return
	is_destroyed = true
	if spawner and spawner.has_method("enemy_destroyed"):
		spawner.enemy_destroyed()
	emit_signal("escaped")
	queue_free()

func take_damage(damage: float) -> void:
	if is_destroyed:
		return
	hp -= damage
	damage_animation()
	if hp <= 0:
		is_destroyed = true
		if spawner and spawner.has_method("enemy_destroyed"):
			spawner.enemy_destroyed()
		emit_signal("died", reward)
		queue_free()

func damage_animation():
	var tween := create_tween()
	tween.tween_property(self, "v_offset", 0, 0.05)
	tween.tween_property(self, "modulate", Color.ORANGE_RED, 0.1)
	tween.tween_property(self, "modulate", Color.WHITE, 0.3)
	tween.set_parallel()
	tween.tween_property(self, "v_offset", -5, 0.2)
	tween.set_parallel(false)
	tween.tween_property(self, "v_offset", 0, 0.2)

func init_from_config(conf: Dictionary) -> void:
	max_hp = conf.get("hp", max_hp)
	hp = max_hp
	speed = conf.get("speed", base_speed)
	base_speed = speed
	reward = conf.get("reward", reward)
	base_damage = conf.get("base_damage", base_damage)

	# 스프라이트 경로를 직접 읽어오기
	var sprite_path = conf.get("sprite_path", "")
	if sprite_path != "":
		_setup_animation(sprite_path)
	else:
		# 백업으로 type 사용
		var t = conf.get("type", "dino1")
		_set_enemy_sprite(t)

	# 특정 프레임 시작(옵션)
	var frame_index = conf.get("frame", null)
	if sprite and frame_index is int and frame_index >= 0:
		sprite.frame = frame_index
	

func apply_slow(factor: float, duration: float) -> void:
	speed = base_speed * factor
	var timer = get_tree().create_timer(duration)
	timer.timeout.connect(func(): speed = base_speed)
