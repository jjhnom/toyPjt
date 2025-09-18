extends Node2D
@export var range:float = 120.0
@export var damage:int = 12
@export var rate:float = 0.8
@export var projectile_scene:PackedScene
var level:int = 1
var id:String = "archer"
var cd:float = 0.0
var in_range:Array = []
@onready var area:Area2D = $RangeArea
@onready var sprite:AnimatedSprite2D = $AnimatedSprite2D

# 캐릭터 애니메이션 설정
@export var anim_name := "idle"
@export var fps := 8.0

# 캐릭터 스프라이트는 characters.json에서 sprite_path로 설정됨
# 스프라이트 프레임 캐시
var _frames_cache: Dictionary = {}
func init_from_config(conf:Dictionary, _level:int, _id:String) -> void:
	id = _id; level = _level
	damage = conf.get("atk", damage) + (level-1)*4
	range = conf.get("range", range) + (level-1)*8
	rate = conf.get("rate", rate) * max(0.7, 1.0 - (level-1)*0.05)
	var shape:CollisionShape2D = area.get_node("CollisionShape2D")
	if shape and shape.shape is CircleShape2D: shape.shape.radius = range
	
	# JSON에서 스프라이트 경로 직접 읽어오기
	var sprite_path = conf.get("sprite_path", "")
	if sprite_path != "":
		_set_character_sprite_from_path(sprite_path)
	else:
		# 백업으로 기존 방식 사용
		_set_character_sprite_backup(_id)
	
	# JSON에서 기본 스케일 값 읽어오기
	var base_scale = conf.get("scale", 1.0)
	
	# 레벨에 따른 추가 크기 조정
	var level_scale_bonus = (level - 1) * 0.1  # 레벨당 10% 크기 증가
	var final_scale = base_scale + level_scale_bonus
	
	# 스프라이트 크기 적용
	if sprite:
		sprite.scale = Vector2(final_scale, final_scale)
	

func _set_character_sprite_from_path(sprite_path: String) -> void:
	if sprite:
		_setup_animation(sprite_path)

func _setup_animation(sprite_strip_path: String) -> void:
	if not sprite:
		return
	
	# 캐시 먼저 확인
	if _frames_cache.has(sprite_strip_path):
		sprite.sprite_frames = _frames_cache[sprite_strip_path]
		sprite.animation = anim_name
		sprite.play()
		return

	var tex := load(sprite_strip_path) as Texture2D
	if not tex:
		return

	var frames := SpriteFrames.new()
	frames.add_animation(anim_name)
	frames.set_animation_speed(anim_name, fps)

	# 특정 파일들에 대한 그리드 정보
	var frame_width: int
	var frame_height: int
	var cols: int
	var rows: int
	
	if sprite_strip_path.ends_with("archer.png"):
		# archer 전용: 8x2 그리드, 각 프레임 192x512
		frame_width = 192
		frame_height = 512
		cols = 8
		rows = 2
		print("Frame size: %d x %d case 1" % [frame_width, frame_height])
	else:
		# 기본: 가로로 나열된 정사각형 프레임들
		frame_height = tex.get_height()
		frame_width = frame_height  # 정사각형 가정
		cols = int(tex.get_width() / float(frame_width))
		rows = 1
		print("Frame size: %d x %d case 2" % [frame_width, frame_height])
	# 그리드에서 프레임들 추출
	for row in range(rows):
		for col in range(cols):
			var atlas := AtlasTexture.new()
			atlas.atlas = tex
			atlas.region = Rect2(col * frame_width, row * frame_height, frame_width, frame_height)
			frames.add_frame(anim_name, atlas)

	_frames_cache[sprite_strip_path] = frames

	sprite.sprite_frames = frames
	sprite.animation = anim_name
	sprite.play()

func _set_character_sprite_backup(character_id: String) -> void:
	# 백업용 기본 애니메이션 스프라이트 경로들
	var backup_sprites = {
		"archer": "res://assets/turrets/archer_96x96_sheet_96_transparent.png",
		"knight": "res://assets/turrets/archer_96x96_sheet_96_transparent.png", 
		"mage": "res://assets/turrets/archer_96x96_sheet_96_transparent.png",
		"cleric": "res://assets/turrets/archer_96x96_sheet_96_transparent.png"
	}
	
	var texture_path = backup_sprites.get(character_id, "res://assets/turrets/archer_96x96_sheet_96_transparent.png")
	_set_character_sprite_from_path(texture_path)
func _ready() -> void:
	
	# AnimatedSprite2D 노드 초기화 확인
	if not sprite:
		sprite = get_node("AnimatedSprite2D")
	
	# Area2D 끼리의 충돌을 감지 (Enemy의 HitboxArea와 Character의 RangeArea)
	area.area_entered.connect(_on_area_enter)
	area.area_exited.connect(_on_area_exit)
	
func _on_area_enter(area:Area2D) -> void:
	var enemy = area.get_parent()  # HitboxArea의 부모는 Enemy
	if enemy.has_method("take_damage"): 
		in_range.append(enemy)

func _on_area_exit(area:Area2D) -> void:
	var enemy = area.get_parent()  # HitboxArea의 부모는 Enemy
	in_range.erase(enemy)

func _process(delta:float) -> void:
	# 쿨다운 체크
	cd -= delta
	if cd > 0: 
		return
	
	# 유효한 적들만 필터링
	var old_count = in_range.size()
	in_range = in_range.filter(is_instance_valid)
	
	# 적이 없으면 공격 안함
	if in_range.is_empty(): 
		return
	
	# 첫 번째 적 공격
	var t = in_range[0]
	_fire(t)
	cd = rate

func _fire(t:Node) -> void:
	var ps = projectile_scene if projectile_scene != null else preload("res://scenes/Projectile.tscn")
	var pool = $"/root/Main/GameManager/ObjectPool"
	var p = pool.pop("Projectile", func(): return ps.instantiate())
	
	# ObjectPool에서 올바르게 제거되었으므로 바로 추가
	var target_parent = get_parent()
	target_parent.add_child(p)
	p.global_position = global_position
	p.shoot_at(t, damage)
