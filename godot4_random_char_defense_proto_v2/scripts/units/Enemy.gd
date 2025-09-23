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
var health_bar: Control
var health_bar_fill: ColorRect
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
	
	# 체력바 노드들 찾기
	health_bar = get_node("HealthBar")
	health_bar_fill = get_node("HealthBar/HealthBarFill")
	
	# 스프라이트가 타일 위에 보이도록 z_index 설정
	if sprite:
		sprite.z_index = 1
	
	# 체력바가 몬스터 위에 보이도록 z_index 설정
	if health_bar:
		health_bar.z_index = 2
	
	# 체력바 초기화
	update_health_bar()

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
		# 파일명 형식 문제일 수 있으므로 대체 경로 시도
		var alt_path = sprite_strip_path
		if sprite_strip_path.contains("0_Satyr_Walking"):
			alt_path = sprite_strip_path.replace("0_Satyr_Walking", "Satyr_01_Walking")
			tex = load(alt_path) as Texture2D
		elif sprite_strip_path.contains("0_Wraith_Walking"):
			# Wraith 폴더에 따라 적절한 파일명으로 변환
			if sprite_strip_path.contains("Wraith_01"):
				alt_path = sprite_strip_path.replace("0_Wraith_Walking", "Wraith_01_Moving Forward")
			elif sprite_strip_path.contains("Wraith_02"):
				alt_path = sprite_strip_path.replace("0_Wraith_Walking", "Wraith_02_Moving Forward")
			elif sprite_strip_path.contains("Wraith_03"):
				alt_path = sprite_strip_path.replace("0_Wraith_Walking", "Wraith_03_Moving Forward")
			else:
				alt_path = sprite_strip_path.replace("0_Wraith_Walking", "Wraith_01_Moving Forward")
			tex = load(alt_path) as Texture2D
		
		if not tex:
			push_warning("스프라이트 이미지 로드 실패: %s (대체 경로도 실패: %s)" % [sprite_strip_path, alt_path])
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

# 개별 이미지 파일들로 walking 애니메이션 구성
func _setup_walking_animation(walking_folder: String, conf: Dictionary) -> void:
	if not sprite:
		return
	
	# 캐시 키 생성
	var cache_key = walking_folder
	if _frames_cache.has(cache_key):
		sprite.sprite_frames = _frames_cache[cache_key]
		sprite.animation = anim_name
		sprite.play()
		return
	
	# 애니메이션 정보 가져오기
	var animations = conf.get("animations", {})
	var walking_info = animations.get("walking", {"frames": 24, "fps": 12.0})
	var frame_count = walking_info.get("frames", 24)
	var fps_value = walking_info.get("fps", 12.0)
	
	var frames := SpriteFrames.new()
	frames.add_animation(anim_name)
	frames.set_animation_speed(anim_name, fps_value)
	
	# 각 프레임 이미지 로드
	var loaded_count = 0
	for i in range(frame_count):
		var frame_path = ""
		
		# 파일명 패턴 확인 (여러 형태 지원)
		if walking_folder.contains("Male Goblin") or walking_folder.contains("Female Goblin"):
			# "Right - Walking_000.png" 형태
			frame_path = walking_folder + ("Right - Walking_%03d.png" % i)
		else:
			# "0_Enemy_Walking_000.png" 형태
			var enemy_name = ""
			if walking_folder.contains("Goblin"):
				enemy_name = "Goblin"
			elif walking_folder.contains("Orc"):
				enemy_name = "Orc"
			elif walking_folder.contains("Skeleton_Warrior"):
				enemy_name = "Skeleton_Warrior"
			elif walking_folder.contains("Skeleton_Crusader"):
				enemy_name = "Skeleton_Crusader"
			elif walking_folder.contains("Minotaur"):
				enemy_name = "Minotaur"
			elif walking_folder.contains("Golem"):
				enemy_name = "Golem"
			elif walking_folder.contains("Ogre"):
				enemy_name = "Ogre"
			elif walking_folder.contains("Wraith"):
				# Wraith는 특별한 파일명 형식 사용
				if walking_folder.contains("Wraith_01"):
					frame_path = walking_folder + ("Wraith_01_Moving Forward_%03d.png" % i)
				elif walking_folder.contains("Wraith_02"):
					frame_path = walking_folder + ("Wraith_02_Moving Forward_%03d.png" % i)
				elif walking_folder.contains("Wraith_03"):
					frame_path = walking_folder + ("Wraith_03_Moving Forward_%03d.png" % i)
				else:
					enemy_name = "Wraith"
					frame_path = walking_folder + ("0_%s_Walking_%03d.png" % [enemy_name, i])
				continue  # 다음 반복으로 넘어감
			elif walking_folder.contains("Necromancer"):
				# Necromancer는 특별한 파일명 형식 사용
				if walking_folder.contains("Necromancer_of_the_Shadow_1"):
					frame_path = walking_folder + ("0_Necromancer_of_the_Shadow_Walking_%03d.png" % i)
				elif walking_folder.contains("Necromancer_of_the_Shadow_2"):
					frame_path = walking_folder + ("0_Necromancer_of_the_Shadow_Walking_%03d.png" % i)
				elif walking_folder.contains("Necromancer_of_the_Shadow_3"):
					frame_path = walking_folder + ("0_Necromancer_of_the_Shadow_Walking_%03d.png" % i)
				else:
					enemy_name = "Necromancer"
					frame_path = walking_folder + ("0_%s_Walking_%03d.png" % [enemy_name, i])
				continue  # 다음 반복으로 넘어감
			elif walking_folder.contains("Fallen_Angels"):
				enemy_name = "Fallen_Angels"
			elif walking_folder.contains("Valkyrie"):
				enemy_name = "Valkyrie"
			elif walking_folder.contains("Reaper"):
				enemy_name = "Reaper_Man"
			elif walking_folder.contains("Zombie_Villager"):
				enemy_name = "Zombie_Villager"
			elif walking_folder.contains("Dark_Oracle"):
				enemy_name = "Dark_Oracle"
			elif walking_folder.contains("Satyr"):
				# Satyr는 특별한 파일명 형식 사용
				if walking_folder.contains("Satyr_01"):
					frame_path = walking_folder + ("Satyr_01_Walking_%03d.png" % i)
				elif walking_folder.contains("Satyr_02"):
					frame_path = walking_folder + ("Satyr_02_Walking_%03d.png" % i)
				elif walking_folder.contains("Satyr_03"):
					frame_path = walking_folder + ("Satyr_03_Walking_%03d.png" % i)
				else:
					enemy_name = "Satyr"
					frame_path = walking_folder + ("0_%s_Walking_%03d.png" % [enemy_name, i])
				continue  # 다음 반복으로 넘어감
			
			frame_path = walking_folder + ("0_%s_Walking_%03d.png" % [enemy_name, i])
		
		var tex = load(frame_path) as Texture2D
		if tex:
			frames.add_frame(anim_name, tex)
			loaded_count += 1
	
	if loaded_count > 0:
		_frames_cache[cache_key] = frames
		sprite.sprite_frames = frames
		sprite.animation = anim_name
		sprite.play()
	else:
		# 백업으로 기존 방식 사용
		var sprite_path = conf.get("sprite_path", "")
		if sprite_path != "":
			_setup_animation(sprite_path)

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
	hp = max(0, hp)  # 체력이 0 아래로 내려가지 않도록
	update_health_bar()
	damage_animation()
	if hp <= 0:
		is_destroyed = true
		if spawner and spawner.has_method("enemy_destroyed"):
			spawner.enemy_destroyed()
		emit_signal("died", reward)
		queue_free()

func update_health_bar() -> void:
	if not health_bar_fill:
		return
	
	if not health_bar:
		return
	
	# 체력 비율 계산 (0.0 ~ 1.0)
	var health_ratio = hp / max_hp if max_hp > 0 else 0.0
	health_ratio = clamp(health_ratio, 0.0, 1.0)
	
	# 체력바 너비 업데이트
	var bar_width = health_bar.size.x
	health_bar_fill.size.x = bar_width * health_ratio
	
	# 체력에 따라 색상 변경 (더 밝고 눈에 띄게)
	if health_ratio > 0.6:
		health_bar_fill.color = Color(0.0, 1.0, 0.0, 1.0)  # 밝은 초록색
	elif health_ratio > 0.3:
		health_bar_fill.color = Color(1.0, 1.0, 0.0, 1.0)  # 밝은 노란색
	else:
		health_bar_fill.color = Color(1.0, 0.0, 0.0, 1.0)  # 밝은 빨간색

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
	
	# 체력바 업데이트
	update_health_bar()

	# walking_folder가 있으면 개별 이미지 파일들로 애니메이션 구성
	var walking_folder = conf.get("walking_folder", "")
	if walking_folder != "":
		_setup_walking_animation(walking_folder, conf)
	else:
		# 스프라이트 경로를 직접 읽어오기 (기존 방식)
		var sprite_path = conf.get("sprite_path", "")
		if sprite_path != "":
			_setup_animation(sprite_path)
		else:
			# 백업으로 type 사용
			var t = conf.get("type", "dino1")
			_set_enemy_sprite(t)

	# 스케일 적용
	var scale_value = conf.get("scale", 1.0)
	if sprite:
		sprite.scale = Vector2(scale_value, scale_value)
	
	# 체력바 크기와 위치 조정 (몬스터 하단에 명확히 표시)
	if health_bar and sprite:
		# 체력바는 몬스터보다 크게 표시 (스케일의 2배)
		health_bar.scale = Vector2(scale_value * 2.0, scale_value * 2.0)
		
		# 몬스터 스프라이트 크기를 고려한 체력바 위치 계산
		var sprite_height = 0.0
		if sprite.sprite_frames and sprite.sprite_frames.has_animation(sprite.animation):
			var frame_texture = sprite.sprite_frames.get_frame_texture(sprite.animation, 0)
			if frame_texture:
				sprite_height = frame_texture.get_height() * scale_value
		
		# 스프라이트 하단에서 약간 떨어진 위치에 체력바 배치
		health_bar.position.y = (sprite_height / 2.0) + 10.0 * scale_value
		health_bar.position.x = -5

		# 체력바가 항상 보이도록 z_index를 더 높게 설정
		health_bar.z_index = 10

	# 특정 프레임 시작(옵션)
	var frame_index = conf.get("frame", null)
	if sprite and frame_index is int and frame_index >= 0:
		sprite.frame = frame_index
	

func apply_slow(factor: float, duration: float) -> void:
	speed = base_speed * factor
	var timer = get_tree().create_timer(duration)
	timer.timeout.connect(func(): 
		speed = base_speed
	)
