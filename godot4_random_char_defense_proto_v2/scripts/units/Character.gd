extends Node2D
@export var range:float = 120.0
@export var damage:int = 12
@export var rate:float = 0.8
@export var projectile_scene:PackedScene
var level:int = 1
var id:String = "archer"
var cd:float = 0.0
var in_range:Array = []
var is_attacking:bool = false
var last_target:Node = null
@onready var area:Area2D = $RangeArea
@onready var sprite:AnimatedSprite2D = $AnimatedSprite2D
var level_label:Label = null

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
	
	# 레벨 라벨 업데이트
	_update_level_label()
	

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

	# 새로운 캐릭터들의 프레임 정보
	var frame_width: int
	var frame_height: int
	var cols: int
	var rows: int
	
	# 캐릭터별 프레임 설정 - 개선된 프레임 수 추정
	if sprite_strip_path.contains("Archer") or sprite_strip_path.contains("Warrior") or sprite_strip_path.contains("Lancer"):
		# 새로운 캐릭터들: 실제 가로세로 비율을 기반으로 정확한 프레임 수 계산
		frame_height = tex.get_height()
		
		# 가로세로 비율로 정확한 프레임 수 계산
		var aspect_ratio = float(tex.get_width()) / float(tex.get_height())
		var estimated_cols = aspect_ratio
		
		# 정수로 정확히 나누어떨어지는지 확인해서 더 정확한 판정
		var possible_frames = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
		cols = 1  # 기본값
		
		for frame_count in possible_frames:
			var calculated_frame_width = float(tex.get_width()) / float(frame_count)
			var width_error = abs(calculated_frame_width - int(calculated_frame_width))
			
			# 프레임 너비가 정수에 가깝고(오차 0.1 이하), 가로세로 비율도 맞으면 선택
			if width_error < 0.1 and abs(estimated_cols - frame_count) < 0.5:
				cols = frame_count
				break
		
		# 위의 정확한 계산이 실패하면 기존 방식 사용
		if cols == 1:
			if estimated_cols >= 11.7:
				cols = 12
			elif estimated_cols >= 10.7:
				cols = 11
			elif estimated_cols >= 9.7:
				cols = 10
			elif estimated_cols >= 8.7:
				cols = 9
			elif estimated_cols >= 7.7:
				cols = 8
			elif estimated_cols >= 6.7:
				cols = 7
			elif estimated_cols >= 5.7:
				cols = 6
			elif estimated_cols >= 4.7:
				cols = 5
			elif estimated_cols >= 3.7:
				cols = 4
			elif estimated_cols >= 2.7:
				cols = 3
			elif estimated_cols >= 1.7:
				cols = 2
			else:
				cols = 1
			
		frame_width = tex.get_width() / cols
		rows = 1
		
		var character_name = ""
		if sprite_strip_path.contains("Archer"):
			character_name = "Archer"
		elif sprite_strip_path.contains("Warrior"):
			character_name = "Warrior"  
		elif sprite_strip_path.contains("Lancer"):
			character_name = "Lancer"
			
		print("%s 프레임 분석: 이미지크기 %dx%d -> 가로세로비율 %.1f -> 실제사용 %d프레임 (크기: %dx%d)" % 
			  [character_name, tex.get_width(), tex.get_height(), estimated_cols, cols, frame_width, frame_height])
			  
	elif sprite_strip_path.contains("Monk"):
		# Monk 애니메이션들 - 현재 잘 작동하므로 유지
		frame_height = tex.get_height()
		if sprite_strip_path.contains("Heal") and not sprite_strip_path.contains("Effect"):
			# Heal: 8프레임
			frame_width = tex.get_width() / 8
			cols = 8
		else:
			# Idle, Run: 6프레임
			frame_width = tex.get_width() / 6
			cols = 6
		rows = 1
		print("Monk 프레임 크기: %d x %d, 열: %d" % [frame_width, frame_height, cols])
	elif sprite_strip_path.ends_with("archer.png"):
		# 기존 archer.png (8x2 그리드)
		frame_width = 192
		frame_height = 512
		cols = 8
		rows = 2
		print("Legacy Archer 프레임 크기: %d x %d" % [frame_width, frame_height])
	else:
		# 기본: 가로로 나열된 정사각형 프레임들
		frame_height = tex.get_height()
		frame_width = frame_height  # 정사각형 가정
		cols = int(tex.get_width() / float(frame_width))
		rows = 1
		print("기본 프레임 크기: %d x %d" % [frame_width, frame_height])
	
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
	
	# 애니메이션 완료 시그널 연결
	if sprite:
		sprite.animation_finished.connect(_on_animation_finished)
	
	# Area2D 끼리의 충돌을 감지 (Enemy의 HitboxArea와 Character의 RangeArea)
	area.area_entered.connect(_on_area_enter)
	area.area_exited.connect(_on_area_exit)
	
	# 레벨 라벨 생성
	_create_level_label()
	
func _on_area_enter(area:Area2D) -> void:
	var enemy = area.get_parent()  # HitboxArea의 부모는 Enemy
	if enemy.has_method("take_damage"): 
		in_range.append(enemy)

func _on_area_exit(area:Area2D) -> void:
	var enemy = area.get_parent()  # HitboxArea의 부모는 Enemy
	in_range.erase(enemy)

func _on_animation_finished() -> void:
	# 공격 애니메이션이 끝나면 상황에 따라 애니메이션 전환
	if sprite and sprite.animation.begins_with("attack"):
		# 사거리 내에 적이 있으면 계속 공격 대기, 없으면 idle
		var valid_targets = []
		for enemy in in_range:
			if is_instance_valid(enemy):
				var distance = global_position.distance_to(enemy.global_position)
				if distance <= range:
					valid_targets.append(enemy)
		
		if valid_targets.is_empty():
			is_attacking = false
			last_target = null
			play_idle_animation()
			print("%s: 공격 애니메이션 완료 - idle 전환" % id)
		else:
			print("%s: 공격 애니메이션 완료 - 대기 상태" % id)

func _process(delta:float) -> void:
	# 유효한 적들만 필터링
	in_range = in_range.filter(is_instance_valid)
	
	# 사거리 내에 정확히 있는 적들만 다시 필터링
	var valid_targets = []
	for enemy in in_range:
		var distance = global_position.distance_to(enemy.global_position)
		if distance <= range:
			valid_targets.append(enemy)
	
	# 사거리 내에 적이 없으면 idle 상태로 전환
	if valid_targets.is_empty():
		if is_attacking:
			is_attacking = false
			last_target = null
			play_idle_animation()
			print("%s: 사거리 내 적 없음 - idle 전환" % id)
		return
	
	# 쿨다운 체크 (적이 있을 때만)
	cd -= delta
	if cd > 0: 
		return
	
	# 가장 가까운 적을 우선 타겟으로 선택
	var closest_target = _get_closest_target(valid_targets)
	if closest_target:
		_fire(closest_target)
		cd = rate

# 가장 가까운 적을 찾는 함수
func _get_closest_target(targets: Array) -> Node:
	if targets.is_empty():
		return null
	
	var closest = targets[0]
	var closest_distance = global_position.distance_to(closest.global_position)
	
	for target in targets:
		var distance = global_position.distance_to(target.global_position)
		if distance < closest_distance:
			closest = target
			closest_distance = distance
	
	return closest

func _fire(t:Node) -> void:
	# 공격 상태 업데이트
	is_attacking = true
	last_target = t
	
	# 공격 애니메이션 재생 (적의 위치 정보 전달)
	if id == "lancer" and t:
		play_lancer_attack_towards_target(t)
	else:
		play_attack_animation()
	
	var ps = projectile_scene if projectile_scene != null else preload("res://scenes/Projectile.tscn")
	var pool = $"/root/Main/GameManager/ObjectPool"
	var p = pool.pop("Projectile", func(): return ps.instantiate())
	
	# ObjectPool에서 올바르게 제거되었으므로 바로 추가
	var target_parent = get_parent()
	target_parent.add_child(p)
	p.global_position = global_position
	p.shoot_at(t, damage)
	
	print("%s: %s를 공격! 거리: %.1f" % [id, t.name if t.has_method("get") else "적", global_position.distance_to(t.global_position)])

# 캐릭터별 애니메이션 재생 함수들
func play_attack_animation() -> void:
	var config = _get_character_config()
	
	# Lancer의 경우 방향별 공격 애니메이션 선택
	if id == "lancer":
		_play_lancer_directional_attack(config)
	elif config.has("attack_sprite"):
		_set_character_sprite_from_path(config.attack_sprite)
	elif config.has("attack2_sprite") and randf() > 0.5:
		_set_character_sprite_from_path(config.attack2_sprite)

# Lancer 전용 방향별 공격 애니메이션
func _play_lancer_directional_attack(config: Dictionary) -> void:
	# 현재는 랜덤하게 방향을 선택 (추후 적의 위치에 따라 개선 가능)
	var directions = ["right", "down", "up", "downright", "upright"]
	var selected_direction = directions[randi() % directions.size()]
	
	var attack_key = "attack_" + selected_direction
	if config.has(attack_key):
		_set_character_sprite_from_path(config[attack_key])
		print("Lancer %s 방향 공격!" % selected_direction)
	else:
		# 백업으로 기본 공격 스프라이트 사용
		if config.has("attack_sprite"):
			_set_character_sprite_from_path(config.attack_sprite)

# Lancer가 적을 향해 방향별 공격하는 함수
func play_lancer_attack_towards_target(target: Node) -> void:
	var config = _get_character_config()
	if not target:
		_play_lancer_directional_attack(config)
		return
	
	# 적의 위치에 따라 방향 결정
	var direction_to_target = target.global_position - global_position
	var selected_direction = _get_direction_name(direction_to_target)
	
	var attack_key = "attack_" + selected_direction
	
	# 존재하지 않는 방향을 사용 가능한 방향으로 매핑
	if not config.has(attack_key):
		match selected_direction:
			"downleft":
				selected_direction = "down"
			"left":
				selected_direction = "right"
			"upleft":
				selected_direction = "up"
		attack_key = "attack_" + selected_direction
	
	if config.has(attack_key):
		_set_character_sprite_from_path(config[attack_key])
		print("Lancer %s 방향으로 적 공격! (적 위치: %s)" % [selected_direction, target.global_position])
	else:
		# 백업으로 기본 공격 스프라이트 사용
		if config.has("attack_sprite"):
			_set_character_sprite_from_path(config.attack_sprite)

# 방향 벡터를 방향 이름으로 변환
func _get_direction_name(direction: Vector2) -> String:
	direction = direction.normalized()
	
	# 8방향으로 분류
	var angle = direction.angle()
	var degrees = rad_to_deg(angle)
	
	# 각도를 0-360도로 정규화
	if degrees < 0:
		degrees += 360
	
	# 8방향 분류 (각 방향당 45도)
	if degrees >= 337.5 or degrees < 22.5:
		return "right"
	elif degrees >= 22.5 and degrees < 67.5:
		return "downright"
	elif degrees >= 67.5 and degrees < 112.5:
		return "down"
	elif degrees >= 112.5 and degrees < 157.5:
		return "downleft"  # 없으면 down 사용
	elif degrees >= 157.5 and degrees < 202.5:
		return "left"  # 없으면 right 사용
	elif degrees >= 202.5 and degrees < 247.5:
		return "upleft"  # 없으면 up 사용
	elif degrees >= 247.5 and degrees < 292.5:
		return "up"
	else:  # 292.5 - 337.5
		return "upright"

# 레벨 라벨 생성 함수
func _create_level_label() -> void:
	if level_label:
		return  # 이미 생성된 경우
	
	level_label = Label.new()
	level_label.name = "LevelLabel"
	
	# 라벨 스타일 설정
	level_label.text = "Lv.%d" % level
	level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	
	# 폰트 크기와 색상 설정
	var label_settings = LabelSettings.new()
	label_settings.font_size = 14
	label_settings.font_color = Color.WHITE
	label_settings.outline_size = 2
	label_settings.outline_color = Color.BLACK
	level_label.label_settings = label_settings
	
	# 크기 설정 (자동 크기 조정)
	level_label.size = Vector2(40, 20)
	level_label.position = Vector2(-20, -60)  # 캐릭터 머리 위 위치
	
	# 캐릭터에 추가
	add_child(level_label)
	
	print("%s: 레벨 라벨 생성 완료 (Lv.%d)" % [id, level])

# 레벨 라벨 업데이트 함수  
func _update_level_label() -> void:
	if not level_label:
		_create_level_label()
		return
	
	level_label.text = "Lv.%d" % level
	print("%s: 레벨 라벨 업데이트 (Lv.%d)" % [id, level])

func play_idle_animation() -> void:
	var config = _get_character_config()
	if config.has("sprite_path"):
		_set_character_sprite_from_path(config.sprite_path)

func play_run_animation() -> void:
	var config = _get_character_config()
	if config.has("run_sprite"):
		_set_character_sprite_from_path(config.run_sprite)

func play_special_animation(anim_type: String) -> void:
	var config = _get_character_config()
	match anim_type:
		"heal":
			if config.has("heal_sprite"):
				_set_character_sprite_from_path(config.heal_sprite)
		"guard":
			if config.has("guard_sprite"):
				_set_character_sprite_from_path(config.guard_sprite)

func _get_character_config() -> Dictionary:
	# 여러 경로를 시도해서 DataHub 찾기
	var data_hub = get_node_or_null("/root/Main/GameManager/DataHub")
	
	# 첫 번째 경로가 실패하면 다른 경로들 시도
	if not data_hub:
		data_hub = get_node_or_null("/root/Main/DataHub")
	
	if not data_hub:
		# 상대 경로로도 시도
		data_hub = get_node_or_null("../../../GameManager/DataHub")
	
	if data_hub and data_hub.has_method("get_character_data"):
		return data_hub.get_character_data(id)
	else:
		if not data_hub:
			print("경고: DataHub를 찾을 수 없습니다. 캐릭터 ID: %s" % id)
		else:
			print("경고: DataHub에서 get_character_data 메서드를 찾을 수 없습니다.")
	
	return {}
