extends Node2D
@export var attack_range:float = 120.0
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

# 업그레이드 관련 변수
var atk_upgrades:int = 0  # 공격력 업그레이드 횟수
var range_upgrades:int = 0  # 사거리 업그레이드 횟수
var max_upgrades:int = 3  # 각 스탯당 최대 업그레이드 횟수

# 레벨별 색상 시스템
var level_colors: Array[Color] = [
	Color.WHITE,           # 레벨 1: 흰색
	Color.LIGHT_BLUE,      # 레벨 2: 연한 파란색
	Color.GREEN,           # 레벨 3: 초록색
	Color.YELLOW,          # 레벨 4: 노란색
	Color.ORANGE,          # 레벨 5: 주황색
	Color.RED,             # 레벨 6: 빨간색
	Color.PURPLE,          # 레벨 7: 보라색 (업그레이드 후)
	Color.GOLD,            # 레벨 8: 금색 (업그레이드 후)
	Color.CYAN,            # 레벨 9: 청록색 (업그레이드 후)
	Color.MAGENTA,         # 레벨 10: 자홍색 (최고급)
	Color(1.0, 0.5, 0.0),  # 레벨 11: 주황-금색 (전설급)
	Color(0.5, 0.0, 1.0)   # 레벨 12+: 보라-금색 (신화급)
]

# 레벨에 따른 색상 반환 함수
func get_level_color() -> Color:
	var effective_level = level
	
	# 업그레이드가 있으면 레벨에 추가 보너스 적용
	var upgrade_bonus = atk_upgrades + range_upgrades
	effective_level += upgrade_bonus
	
	# 색상 배열 범위 내에서 색상 반환
	var color_index = min(effective_level - 1, level_colors.size() - 1)
	return level_colors[max(0, color_index)]

# 레벨에 따른 폰트 크기 반환 함수
func get_level_font_size() -> int:
	var effective_level = level
	var upgrade_bonus = atk_upgrades + range_upgrades
	effective_level += upgrade_bonus
	
	# 기본 14에서 시작해서 레벨이 높을수록 크기 증가
	var base_size = 14
	var size_bonus = max(0, (effective_level - 6) * 2)  # 6레벨부터 크기 증가
	return base_size + size_bonus

# 캐릭터 애니메이션 설정
@export var anim_name := "idle"
@export var fps := 8.0

# 캐릭터 스프라이트는 characters.json에서 sprite_path로 설정됨
# 스프라이트 프레임 캐시
var _frames_cache: Dictionary = {}
func init_from_config(conf:Dictionary, _level:int, _id:String) -> void:
	id = _id; level = _level
	damage = conf.get("atk", damage) + (level-1)*4
	var base_range = conf.get("range", attack_range)
	var level_range = base_range + (level-1)*12  # 사거리 증가량 증가 (8→12)
	rate = conf.get("rate", rate) * max(0.5, 1.0 - (level-1)*0.08)  # 공격속도 증가량 증가 (0.05→0.08)
	
	# 업그레이드 보너스 적용
	_apply_upgrade_bonuses(conf)
	
	# 새로운 캐릭터 생성 시에는 다른 캐릭터들을 초기화하지 않음
	_apply_attack_range_silent(level_range)
	
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
	
	# 레벨업 효과 표시
	if level > 1:
		_show_levelup_effect()
	

func _set_character_sprite_from_path(sprite_path: String) -> void:
	if sprite:
		_setup_animation(sprite_path)

func _setup_animation(sprite_strip_path: String) -> void:
	if not sprite:
		return
	
	# 스프라이트 경로에 따라 애니메이션 이름 결정
	var animation_name = _get_animation_name_from_path(sprite_strip_path)
	
	# 캐시 먼저 확인
	var cache_key = sprite_strip_path + "_" + animation_name
	if _frames_cache.has(cache_key):
		sprite.sprite_frames = _frames_cache[cache_key]
		sprite.animation = animation_name
		sprite.play()
		return

	var tex := load(sprite_strip_path) as Texture2D
	if not tex:
		return

	var frames := SpriteFrames.new()
	frames.add_animation(animation_name)
	
	# 애니메이션별 FPS 설정
	var animation_fps = _get_animation_fps(animation_name)
	frames.set_animation_speed(animation_name, animation_fps)

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
			
		frame_width = int(float(tex.get_width()) / float(cols))
		rows = 1	
			  
	elif sprite_strip_path.contains("Monk"):
		# Monk 애니메이션들
		frame_height = tex.get_height()
		if sprite_strip_path.contains("Heal") and not sprite_strip_path.contains("Effect"):
			# Heal: 11프레임
			frame_width = int(float(tex.get_width()) / 11.0)
			cols = 11
		else:
			# Idle, Run: 6프레임
			frame_width = int(float(tex.get_width()) / 6.0)
			cols = 6
		rows = 1
	elif sprite_strip_path.ends_with("archer.png"):
		# 기존 archer.png (8x2 그리드)
		frame_width = 192
		frame_height = 512
		cols = 8
		rows = 2
	else:
		# 기본: 가로로 나열된 정사각형 프레임들
		frame_height = tex.get_height()
		frame_width = frame_height  # 정사각형 가정
		cols = int(float(tex.get_width()) / float(frame_width))
		rows = 1
	
	# 그리드에서 프레임들 추출
	for row in range(rows):
		for col in range(cols):
			var atlas := AtlasTexture.new()
			atlas.atlas = tex
			atlas.region = Rect2(col * frame_width, row * frame_height, frame_width, frame_height)
			frames.add_frame(animation_name, atlas)

	_frames_cache[cache_key] = frames

	sprite.sprite_frames = frames
	sprite.animation = animation_name
	sprite.play()

# 스프라이트 경로에서 애니메이션 이름을 추출하는 함수
func _get_animation_name_from_path(sprite_path: String) -> String:
	var filename = sprite_path.get_file().get_basename().to_lower()
	
	if "attack" in filename:
		return "attack"
	elif "heal" in filename:
		return "heal"
	elif "run" in filename:
		return "run"
	elif "guard" in filename or "defence" in filename:
		return "guard"
	else:
		return "idle"

# 애니메이션별 FPS를 가져오는 함수
func _get_animation_fps(animation_name: String) -> float:
	var config = _get_character_config()
	var animations = config.get("animations", {})
	var anim_data = animations.get(animation_name, {"fps": 8.0})
	return anim_data.get("fps", 8.0)


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
	
	# RangeArea 무결성 보장 및 시그널 연결
	_ensure_range_area_integrity()
	
	# 레벨 라벨 생성
	_create_level_label()
	
func _on_area_enter(entered_area:Area2D) -> void:
	var enemy = entered_area.get_parent()  # HitboxArea의 부모는 Enemy
	if enemy.has_method("take_damage"):
		# Enemy의 히트박스 크기 확인
		var enemy_hitbox_radius = 16.0  # 기본값 (Enemy.tscn에서 확인된 값)
		var enemy_area = enemy.get_node_or_null("HitboxArea")
		if enemy_area:
			var enemy_collision = enemy_area.get_node_or_null("CollisionShape2D")
			if enemy_collision and enemy_collision.shape is CircleShape2D:
				enemy_hitbox_radius = enemy_collision.shape.radius
		
		# 실제 공격 가능 거리 = 캐릭터 사거리 + 적 히트박스 반지름 + 여유 (모바일 최적화)
		var distance = global_position.distance_to(enemy.global_position)
		var effective_range = attack_range + enemy_hitbox_radius + 15.0  # 모바일 터치 정확도 고려하여 15픽셀 추가
		
		if distance <= effective_range:
			in_range.append(enemy)

func _on_area_exit(exited_area:Area2D) -> void:
	var enemy = exited_area.get_parent()  # HitboxArea의 부모는 Enemy
	in_range.erase(enemy)

func _on_animation_finished() -> void:
	# 공격 애니메이션이 끝나면 상황에 따라 애니메이션 전환
	if sprite and sprite.animation.begins_with("attack"):
		# 사거리 내에 적이 있으면 계속 공격 대기, 없으면 idle
		var valid_targets = []
		for enemy in in_range:
			if is_instance_valid(enemy):
				var distance = global_position.distance_to(enemy.global_position)
				
				# Enemy 히트박스 크기 고려
				var enemy_hitbox_radius = 16.0  # 기본값
				var enemy_area = enemy.get_node_or_null("HitboxArea")
				if enemy_area:
					var enemy_collision = enemy_area.get_node_or_null("CollisionShape2D")
					if enemy_collision and enemy_collision.shape is CircleShape2D:
						enemy_hitbox_radius = enemy_collision.shape.radius
				
				var effective_range = attack_range + enemy_hitbox_radius
				if distance <= effective_range:
					valid_targets.append(enemy)
		
		if valid_targets.is_empty():
			is_attacking = false
			last_target = null
			play_idle_animation()

func _process(delta:float) -> void:
	_detect_existing_enemies()
	
	# 유효한 적들만 필터링
	in_range = in_range.filter(is_instance_valid)
	
	# 사거리 내에 정확히 있는 적들만 다시 필터링 (Enemy 히트박스 크기 고려)
	var valid_targets = []
	for enemy in in_range:
		var distance = global_position.distance_to(enemy.global_position)
		
		# Enemy의 히트박스 크기 확인
		var enemy_hitbox_radius = 16.0  # 기본값 (Enemy.tscn에서 확인된 값)
		var enemy_area = enemy.get_node_or_null("HitboxArea")
		if enemy_area:
			var enemy_collision = enemy_area.get_node_or_null("CollisionShape2D")
			if enemy_collision and enemy_collision.shape is CircleShape2D:
				enemy_hitbox_radius = enemy_collision.shape.radius
		
		# 실제 공격 가능 거리 = 캐릭터 사거리 + 적 히트박스 반지름 (모바일 최적화)
		var effective_range = attack_range + enemy_hitbox_radius + 10.0  # 모바일 터치 정확도 고려
		
		if distance <= effective_range:
			valid_targets.append(enemy)
	
	# 사거리 내에 적이 없으면 idle 상태로 전환
	if valid_targets.is_empty():
		if is_attacking:
			is_attacking = false
			last_target = null
			play_idle_animation()
		return
	
	# 쿨다운 체크 (적이 있을 때만, 모바일 최적화)
	cd -= delta
	if cd > 0.05:  # 모바일 터치 지연 보정을 위해 50ms 버퍼 추가
		return
	
	# 가장 가까운 적을 우선 타겟으로 선택
	var closest_target = _get_closest_target(valid_targets)
	if closest_target:
		_fire(closest_target)
		cd = rate

# 가장 가까운 적을 찾는 함수 (모바일 최적화)
func _get_closest_target(targets: Array) -> Node:
	if targets.is_empty():
		return null
	
	# 모바일에서는 첫 번째 유효한 적을 우선 선택 (반응성 향상)
	if targets.size() == 1:
		return targets[0]
	
	var closest = targets[0]
	var closest_distance = global_position.distance_to(closest.global_position)
	
	# 가장 가까운 적 찾기 (최대 3마리까지만 검사하여 성능 최적화)
	var max_checks = min(3, targets.size())
	for i in range(max_checks):
		var target = targets[i]
		var distance = global_position.distance_to(target.global_position)
		if distance < closest_distance:
			closest = target
			closest_distance = distance
	
	return closest

func _fire(t:Node) -> void:
	# 기본적인 유효성 검사만 수행
	if not is_instance_valid(t):
		return
	
	var distance_to_target = global_position.distance_to(t.global_position)
	
	# Enemy의 히트박스 크기 확인
	var enemy_hitbox_radius = 16.0  # 기본값
	var enemy_area = t.get_node_or_null("HitboxArea")
	if enemy_area:
		var enemy_collision = enemy_area.get_node_or_null("CollisionShape2D")
		if enemy_collision and enemy_collision.shape is CircleShape2D:
			enemy_hitbox_radius = enemy_collision.shape.radius
	
	# 최종 사거리 검증 (적 히트박스 고려, 모바일 최적화)
	var effective_range = attack_range + enemy_hitbox_radius + 5.0  # 모바일 터치 정확도 고려
	if distance_to_target > effective_range:
		return
	
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
	
	# 창병 넉백 스킬 처리
	if id == "lancer":
		_handle_lancer_knockback(t)
	
	# 전사 배쉬 스킬 처리
	if id == "warrior":
		_handle_warrior_bash(t)
	

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
	label_settings.font_size = get_level_font_size()  # 레벨에 따른 폰트 크기 적용
	label_settings.font_color = get_level_color()     # 레벨에 따른 색상 적용
	label_settings.outline_size = 2
	label_settings.outline_color = Color.BLACK
	level_label.label_settings = label_settings
	
	# 크기 설정 (자동 크기 조정)
	level_label.size = Vector2(40, 20)
	level_label.position = Vector2(-20, -60)  # 캐릭터 머리 위 위치
	
	# 캐릭터에 추가
	add_child(level_label)
	

# 레벨 라벨 업데이트 함수  
func _update_level_label() -> void:
	if not level_label:
		_create_level_label()
		return
	
	level_label.text = "Lv.%d" % level
	
	# 레벨에 따른 색상과 폰트 크기 업데이트
	var label_settings = level_label.label_settings
	if label_settings:
		label_settings.font_color = get_level_color()
		label_settings.font_size = get_level_font_size()
		level_label.label_settings = label_settings
	
	# 높은 레벨에서는 특별한 효과 적용
	var effective_level = level + atk_upgrades + range_upgrades
	if effective_level >= 8:
		_add_level_glow_effect()

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

# 레벨업 효과 표시 함수
func _show_levelup_effect() -> void:
	
	# 시각적 효과 (선택사항)
	if sprite:
		var original_modulate = sprite.modulate
		var tween = create_tween()
		tween.set_loops(3)
		tween.tween_property(sprite, "modulate", Color.GOLD, 0.2)
		tween.tween_property(sprite, "modulate", original_modulate, 0.2)

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
	
	return {}

func _get_slot_number() -> int:
	# CharacterManager에서 슬롯 정보를 확인
	var character_manager = get_node_or_null("/root/Main/GameManager/CharacterManager")
	if not character_manager:
		character_manager = get_node_or_null("../../../GameManager/CharacterManager")
	
	if character_manager and character_manager.has_method("_slot_at"):
		# 현재 위치로 슬롯 번호 찾기
		return character_manager._slot_at(global_position)
	
	return -1

func _is_selected_character() -> bool:
	# CharacterManager에서 선택된 캐릭터 확인
	var character_manager = get_node_or_null("/root/Main/GameManager/CharacterManager")
	if not character_manager:
		character_manager = get_node_or_null("../../../GameManager/CharacterManager")
	
	if character_manager and character_manager.has_method("get") and "selected_character" in character_manager:
		return character_manager.selected_character == self
	
	return false

# 창병 넉백 스킬 처리
func _handle_lancer_knockback(target: Node) -> void:
	if not is_instance_valid(target) or not target.has_method("take_damage"):
		return
	
	# 넉백 확률: 레벨에 따라 증가 (기본 15%, 레벨당 5% 증가)
	var knockback_chance = 0.15 + (level - 1) * 0.05
	var roll = randf()
	
	if roll <= knockback_chance:
		# 넉백 적용
		_apply_knockback(target)

# 넉백 효과 적용
func _apply_knockback(target: Node) -> void:
	if not target or not is_instance_valid(target):
		return
	
	# 넉백 거리: 레벨에 따라 증가 (기본 300픽셀, 레벨당 100픽셀 증가)
	var knockback_distance = 300.0 + (level - 1) * 100.0
	
	# 적이 이동 경로를 벗어나지 않도록 제한
	var path = target.get_parent()
	if path and path is Path2D:
		var curve = path.curve
		if curve:
			# 경로 길이와 현재 진행도 확인
			var path_length = curve.get_baked_length()
			var target_progress = target.progress if "progress" in target else 0.0
			
			# 현재 위치에서 뒤로 넉백하는 것이므로 경로 진행도를 감소
			var knockback_progress = target_progress - (knockback_distance / path_length)
			knockback_progress = max(0.0, knockback_progress)  # 0 이하로 가지 않도록 제한
			
			# 넉백 적용 - 더 강력한 효과
			target.progress = knockback_progress
			
			# 넉백 시각적 효과
			_show_knockback_effect(target)
			
			# 넉백 후 잠시 이동 속도 감소 (0.5초간)
			if target.has_method("set") and "speed" in target:
				var original_speed = target.speed
				target.speed = original_speed * 0.3  # 30% 속도로 감소
				
				# 0.5초 후 원래 속도로 복원 - 안전한 방법
				_restore_enemy_speed_after_delay(target, original_speed, 0.5)

# 적 속도 복원 (지연 후)
func _restore_enemy_speed_after_delay(enemy: Node, original_speed: float, delay: float) -> void:
	# 더 안전한 방법: 직접 타이머 생성 및 처리
	var timer = Timer.new()
	add_child(timer)
	timer.wait_time = delay
	timer.one_shot = true
	timer.start()
	
	# 타이머 완료 시 속도 복원 (lambda 함수 사용, bind 없이)
	timer.timeout.connect(func():
		if is_instance_valid(enemy) and enemy.has_method("set") and "speed" in enemy:
			enemy.speed = original_speed
		
		# 타이머 정리
		if is_instance_valid(timer):
			timer.queue_free()
	, CONNECT_ONE_SHOT)

# 넉백 시각적 효과
func _show_knockback_effect(target: Node) -> void:
	if not target:
		return
	
	# 적을 잠깐 밝은 노란색으로 변경하고 크기도 약간 키워서 넉백 효과 표시
	if target.has_method("set_modulate"):
		var original_modulate = target.modulate
		var original_scale = target.scale if "scale" in target else Vector2.ONE
		
		# 노란색으로 변경하고 크기 증가
		target.modulate = Color.YELLOW
		if "scale" in target:
			target.scale = original_scale * 1.2
		
		# 0.3초 후 원래 색상과 크기로 복원
		var tween = create_tween()
		tween.tween_interval(0.3)
		tween.tween_callback(func(): 
			if is_instance_valid(target):
				target.modulate = original_modulate
				if "scale" in target:
					target.scale = original_scale
		)

# 전사 배쉬 스킬 처리
func _handle_warrior_bash(target: Node) -> void:
	if not target or not is_instance_valid(target):
		return
	
	# 배쉬 확률: 기본 25% + 레벨당 5%
	var bash_chance = 0.25 + (level - 1) * 0.05
	bash_chance = min(bash_chance, 0.6)  # 최대 60%로 제한
	
	var roll = randf()
	if roll <= bash_chance:
		# 배쉬 성공 - 추가 데미지 적용
		_apply_bash_damage(target)

# 배쉬 데미지 적용
func _apply_bash_damage(target: Node) -> void:
	if not target or not is_instance_valid(target):
		return
	
	# 추가 데미지는 기본 공격력과 동일 (2배 데미지 효과)
	var bash_damage = damage
	
	# 적에게 추가 데미지 적용
	if target.has_method("take_damage"):
		target.take_damage(bash_damage)
	
	# 배쉬 시각적 효과
	_show_bash_effect(target)

# 배쉬 시각적 효과
func _show_bash_effect(target: Node) -> void:
	if not target:
		return
	
	# 적을 잠깐 빨간색으로 변경하고 크기도 약간 키워서 배쉬 효과 표시
	if target.has_method("set_modulate"):
		var original_modulate = target.modulate
		var original_scale = target.scale if "scale" in target else Vector2.ONE
		
		# 빨간색으로 변경하고 크기 증가
		target.modulate = Color.RED
		if "scale" in target:
			target.scale = original_scale * 1.3
		
		# 0.2초 후 원래 색상과 크기로 복원
		var tween = create_tween()
		tween.tween_interval(0.2)
		tween.tween_callback(func(): 
			if is_instance_valid(target):
				target.modulate = original_modulate
				if "scale" in target:
					target.scale = original_scale
		)

# 업그레이드 보너스 적용 함수
func _apply_upgrade_bonuses(conf: Dictionary) -> void:
	var upgrades = conf.get("upgrades", {})
	if upgrades.is_empty():
		return
	
	# 공격력 업그레이드 보너스 적용
	var atk_upgrade_amount = upgrades.get("atk_upgrade_amount", 0)
	damage += atk_upgrades * atk_upgrade_amount
	
	# 사거리 업그레이드 보너스 적용 (조용한 방식으로)
	var range_upgrade_amount = upgrades.get("range_upgrade_amount", 0)
	if range_upgrades > 0 and range_upgrade_amount > 0:
		var bonus_range = range_upgrades * range_upgrade_amount
		var new_range = attack_range + bonus_range
		_apply_attack_range_silent(new_range)  # 조용한 방식 사용

# 6레벨 달성 시 업그레이드 가능 여부 확인
func can_upgrade() -> bool:
	return level >= 6 and (atk_upgrades < max_upgrades or range_upgrades < max_upgrades)

# 공격력 업그레이드 가능 여부 확인
func can_upgrade_attack() -> bool:
	return level >= 6 and atk_upgrades < max_upgrades

# 사거리 업그레이드 가능 여부 확인
func can_upgrade_range() -> bool:
	return level >= 6 and range_upgrades < max_upgrades

# 공격력 업그레이드
func upgrade_attack() -> bool:
	if not can_upgrade_attack():
		return false
	
	var conf = _get_character_config()
	var upgrades = conf.get("upgrades", {})
	var cost = upgrades.get("atk_upgrade_cost", 100)
	
	# 골드 확인 및 차감
	var game_manager = get_node_or_null("/root/Main/GameManager")
	if not game_manager or not game_manager.has_method("spend_gold"):
		return false
	
	if not game_manager.spend_gold(cost):
		return false
	
	# 업그레이드 적용
	atk_upgrades += 1
	var atk_upgrade_amount = upgrades.get("atk_upgrade_amount", 5)
	damage += atk_upgrade_amount
	
	# 레벨 라벨 색상 업데이트
	_update_level_label()
	
	# 시각적 효과
	_show_upgrade_effect("공격력")
	
	return true

# 사거리 업그레이드
func upgrade_range() -> bool:
	if not can_upgrade_range():
		return false
	
	var conf = _get_character_config()
	var upgrades = conf.get("upgrades", {})
	var cost = upgrades.get("range_upgrade_cost", 80)
	
	# 골드 확인 및 차감
	var game_manager = get_node_or_null("/root/Main/GameManager")
	if not game_manager or not game_manager.has_method("spend_gold"):
		return false
	
	if not game_manager.spend_gold(cost):
		return false
	
	# 업그레이드 적용
	range_upgrades += 1
	var range_upgrade_amount = upgrades.get("range_upgrade_amount", 30)
	var new_range = attack_range + range_upgrade_amount
	
	# 안전한 사거리 적용 (모니터링 토글, 스냅샷 재구축, 상태 리셋 포함)
	_apply_attack_range(new_range)
	
	# 사거리 업그레이드 시 모든 캐릭터의 상태 초기화
	var character_manager = get_node_or_null("/root/Main/GameManager/CharacterManager")
	if character_manager and character_manager.has_method("_reset_all_characters_state_after_range_upgrade"):
		character_manager._reset_all_characters_state_after_range_upgrade()
	
	# 레벨 라벨 색상 업데이트
	_update_level_label()
	
	# 시각적 효과
	_show_upgrade_effect("사거리")
	
	return true

# 업그레이드 비용 가져오기
func get_upgrade_cost(upgrade_type: String) -> int:
	var conf = _get_character_config()
	var upgrades = conf.get("upgrades", {})
	
	match upgrade_type:
		"attack":
			return upgrades.get("atk_upgrade_cost", 100)
		"range":
			return upgrades.get("range_upgrade_cost", 80)
		_:
			return 0

# 업그레이드 효과 표시
func _show_upgrade_effect(stat_name: String) -> void:
	if not sprite:
		return
	
	# 골드 색상으로 깜빡이는 효과
	var original_modulate = sprite.modulate
	var tween = create_tween()
	tween.set_loops(2)
	tween.tween_property(sprite, "modulate", Color.GOLD, 0.3)
	tween.tween_property(sprite, "modulate", original_modulate, 0.3)
	
	# 업그레이드 텍스트 표시 (선택사항)
	_show_upgrade_text(stat_name)

# 업그레이드 텍스트 표시
func _show_upgrade_text(stat_name: String) -> void:
	var upgrade_label = Label.new()
	upgrade_label.text = "+%s 업그레이드!" % stat_name
	upgrade_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	upgrade_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	
	var label_settings = LabelSettings.new()
	label_settings.font_size = 16
	label_settings.font_color = Color.GOLD
	label_settings.outline_size = 2
	label_settings.outline_color = Color.BLACK
	upgrade_label.label_settings = label_settings
	
	upgrade_label.position = Vector2(-60, -80)
	add_child(upgrade_label)
	
	# 2초 후 제거
	var tween = create_tween()
	tween.tween_interval(2.0)
	tween.tween_callback(func(): upgrade_label.queue_free())

# 레벨 라벨 글로우 효과 추가
func _add_level_glow_effect() -> void:
	if not level_label:
		return
	
	# 이미 글로우 효과가 있는지 확인
	if level_label.get_node_or_null("GlowEffect"):
		return
	
	# 글로우 효과를 위한 Tween 생성
	var glow_tween = create_tween()
	glow_tween.set_loops()  # 무한 반복
	
	# 색상이 서서히 변하는 효과
	var base_color = get_level_color()
	var glow_color = base_color.lightened(0.3)  # 더 밝은 색상
	
	glow_tween.tween_method(_update_glow_color, base_color, glow_color, 1.0)
	glow_tween.tween_method(_update_glow_color, glow_color, base_color, 1.0)

# 글로우 색상 업데이트
func _update_glow_color(color: Color) -> void:
	if level_label and level_label.label_settings:
		level_label.label_settings.font_color = color

# 안전한 사거리 적용 함수
func _apply_attack_range(new_range: float) -> void:
	"""사거리를 안전하게 변경하고 관련 상태를 초기화합니다."""
	
	# 1. RangeArea 모니터링 일시 중단 (물리 재평가 유도)
	area.monitoring = false
	area.monitorable = false
	
	# 2. 사거리 업데이트
	attack_range = new_range
	
	# 3. RangeArea 반경 업데이트
	var shape: CollisionShape2D = area.get_node("CollisionShape2D")
	if shape and shape.shape is CircleShape2D:
		shape.shape.radius = attack_range
	
	# 4. 공격 상태 리셋
	_reset_attack_state()
	
	# 5. 현재 겹치는 적들을 스냅샷으로 재구축
	call_deferred("_rebuild_enemy_snapshot")
	
	# 6. RangeArea 모니터링 재개 (물리 재평가 유도)
	call_deferred("_restore_range_area_monitoring")

# 조용한 사거리 적용 (다른 캐릭터들 초기화하지 않음)
func _apply_attack_range_silent(new_range: float) -> void:
	"""사거리를 안전하게 변경하되 다른 캐릭터들은 초기화하지 않습니다."""
	
	# 1. RangeArea 모니터링 일시 중단 (물리 재평가 유도)
	area.monitoring = false
	area.monitorable = false
	
	# 2. 사거리 업데이트
	attack_range = new_range
	
	# 3. RangeArea 반경 업데이트
	var shape: CollisionShape2D = area.get_node("CollisionShape2D")
	if shape and shape.shape is CircleShape2D:
		shape.shape.radius = attack_range
	
	# 4. 공격 상태 리셋 (자기 자신만)
	_reset_attack_state()
	
	# 5. 현재 겹치는 적들을 스냅샷으로 재구축 (자기 자신만)
	call_deferred("_rebuild_enemy_snapshot")
	
	# 6. RangeArea 모니터링 재개 (물리 재평가 유도)
	call_deferred("_restore_range_area_monitoring")

# RangeArea 모니터링 복원
func _restore_range_area_monitoring() -> void:
	"""RangeArea 모니터링을 복원하고 시그널 연결을 보강합니다."""
	# 모니터링 복원
	area.monitoring = true
	area.monitorable = true
	
	# 레이어/마스크 보호 및 시그널 연결 보강
	_ensure_range_area_integrity()

# RangeArea 무결성 보장
func _ensure_range_area_integrity() -> void:
	"""RangeArea의 레이어/마스크와 시그널 연결을 보장합니다."""
	if not area:
		return
	
	# 레이어/마스크 설정 (Enemy의 HitboxArea와 충돌하도록)
	area.collision_layer = 0  # 자신은 레이어에 없음
	area.collision_mask = 2   # Enemy의 HitboxArea 레이어 (2번)
	
	# 시그널 연결 확인 및 재연결
	if not area.area_entered.is_connected(_on_area_enter):
		area.area_entered.connect(_on_area_enter)
	
	if not area.area_exited.is_connected(_on_area_exit):
		area.area_exited.connect(_on_area_exit)

# 현재 겹치는 적들을 스냅샷으로 재구축
func _rebuild_enemy_snapshot() -> void:
	"""get_overlapping_areas()를 사용하여 현재 겹치는 적들을 재구축합니다."""
	
	# 기존 in_range 배열을 백업하고 새로 구축
	var old_in_range = in_range.duplicate()
	in_range.clear()
	
	# monitoring이 꺼져있으면 모든 Enemy를 직접 검사
	var overlapping_areas = []
	if area.monitoring:
		overlapping_areas = area.get_overlapping_areas()
	
	# 모든 Enemy 노드 검사 (monitoring이 꺼져있을 때도 작동)
	var all_enemies = get_tree().get_nodes_in_group("enemy")
	
	# 모든 Enemy를 직접 거리 검사
	for enemy in all_enemies:
		if is_instance_valid(enemy):
			var distance = global_position.distance_to(enemy.global_position)
			
			# 거리 검증
			var enemy_hitbox_radius = 16.0
			
			# Enemy 히트박스 크기 확인
			var enemy_area = enemy.get_node_or_null("HitboxArea")
			if enemy_area:
				var enemy_collision = enemy_area.get_node_or_null("CollisionShape2D")
				if enemy_collision and enemy_collision.shape is CircleShape2D:
					enemy_hitbox_radius = enemy_collision.shape.radius
			
			var effective_range = attack_range + enemy_hitbox_radius + 15.0
			
			if distance <= effective_range:
				in_range.append(enemy)

# 공격 상태 리셋
func _reset_attack_state() -> void:
	"""공격 상태를 초기화합니다."""
	is_attacking = false
	cd = 0.0
	last_target = null

# 타겟 재설정
func _reset_target() -> void:
	"""현재 타겟을 재설정합니다."""
	last_target = null
	# 사거리 내 적들을 다시 감지
	_detect_existing_enemies()

# 기존 적들을 다시 감지
func _detect_existing_enemies() -> void:
	"""기존 적들을 다시 감지합니다."""
	
	# 기존 in_range 배열 초기화
	in_range.clear()
	
	# 모든 Enemy 노드를 찾아서 사거리 안에 있는지 확인
	var enemies = get_tree().get_nodes_in_group("enemy")
	
	var detected_count = 0
	for enemy in enemies:
		if is_instance_valid(enemy) and enemy.has_method("take_damage"):
			# 거리 확인
			var distance = global_position.distance_to(enemy.global_position)
			var enemy_hitbox_radius = 16.0
			var enemy_area = enemy.get_node_or_null("HitboxArea")
			if enemy_area:
				var enemy_collision = enemy_area.get_node_or_null("CollisionShape2D")
				if enemy_collision and enemy_collision.shape is CircleShape2D:
					enemy_hitbox_radius = enemy_collision.shape.radius
			
			var effective_range = attack_range + enemy_hitbox_radius + 15.0
			
			if distance <= effective_range:
				in_range.append(enemy)
				detected_count += 1
