extends Node2D
class_name Tower

@export var id: String = "archer"
@export var projectile_scene: PackedScene
@onready var data: DataHub = $"../../DataHub"
@onready var gm: GameManager = $"../../GameManager"
@onready var range_area: Area2D = $"RangeArea"
@onready var anim_sprite: AnimatedSprite2D = $AnimatedSprite2D

var stats: Dictionary = {}
var upgrades: Array = []
var level: int = 1
var cooldown: float = 0.0
var in_range: Array = []
var target_mode: String = "first"  # "first", "strong", "close", "weak"
var target_modes: Array = []
var is_attacking: bool = false

func _ready() -> void:
	print("Tower _ready() called for ", id, " at position: ", global_position)
	print("Tower local position: ", position)
	print("Tower parent: ", get_parent())
	print("Tower visible: ", visible)
	print("Tower modulate: ", modulate)
	print("AnimatedSprite2D found: ", anim_sprite != null)
	
	# DataHub가 준비될 때까지 대기
	if not data:
		print("DataHub not ready, waiting...")
		await get_tree().process_frame
		data = get_node("../../DataHub")
	
	var conf: Dictionary = data.towers.get(id, {})
	stats = {
		"range": conf.get("range", 100),
		"fire_rate": conf.get("fire_rate", 1.0),
		"damage": conf.get("damage", 10),
		"aoe_radius": conf.get("aoe_radius", 0.0),
		"penetration": conf.get("penetration", 0.0)
	}
	upgrades = conf.get("upgrade", [])
	target_modes = conf.get("target_modes", ["first"])
	target_mode = target_modes[0] if target_modes.size() > 0 else "first"
	
	print("Tower ", id, " initialized:")
	print("  Position: ", global_position)
	print("  Range: ", stats.range)
	print("  Fire rate: ", stats.fire_rate)
	print("  Damage: ", stats.damage)
	print("  Projectile scene: ", projectile_scene)
	
	if range_area.has_node("CollisionShape2D"):
		var shape: Shape2D = range_area.get_node("CollisionShape2D").shape
		if shape and shape is CircleShape2D:
			shape.radius = stats.range
			print("  Range area radius set to: ", stats.range)
	
	range_area.body_entered.connect(func(b):
		if b.has_method("take_damage"):
			in_range.append(b)
			print("Enemy entered range of tower ", id, " at position: ", b.global_position)
	)
	range_area.body_exited.connect(func(b):
		in_range.erase(b)
		print("Enemy left range of tower ", id)
	)
	
	# 애니메이션 설정
	_setup_animations()
	
	print("Tower ", id, " setup complete")

func _process(delta: float) -> void:
	cooldown -= delta
	if cooldown <= 0.0:
		var target: Node = _pick_target()
		if target:
			print("Tower ", id, " firing at enemy at position: ", target.global_position)
			_fire(target)
			cooldown = stats.fire_rate

func _pick_target() -> Node:
	in_range = in_range.filter(is_instance_valid)
	if in_range.is_empty():
		return null
	
	match target_mode:
		"first":
			return in_range[0]  # 가장 먼저 감지된 적
		"strong":
			return _get_strongest_enemy()
		"weak":
			return _get_weakest_enemy()
		"close":
			return _get_closest_enemy()
		_:
			return in_range[0]

func _get_strongest_enemy() -> Node:
	var strongest = null
	var max_hp = 0.0
	for enemy in in_range:
		if enemy.has_method("get") and enemy.get("hp", 0) > max_hp:
			max_hp = enemy.get("hp", 0)
			strongest = enemy
	return strongest if strongest else in_range[0]

func _get_weakest_enemy() -> Node:
	var weakest = null
	var min_hp = INF
	for enemy in in_range:
		if enemy.has_method("get") and enemy.get("hp", INF) < min_hp:
			min_hp = enemy.get("hp", INF)
			weakest = enemy
	return weakest if weakest else in_range[0]

func _get_closest_enemy() -> Node:
	var closest = null
	var min_distance = INF
	for enemy in in_range:
		var distance = global_position.distance_to(enemy.global_position)
		if distance < min_distance:
			min_distance = distance
			closest = enemy
	return closest if closest else in_range[0]

func cycle_target_mode() -> void:
	if target_modes.size() <= 1:
		return
	
	var current_index = target_modes.find(target_mode)
	var next_index = (current_index + 1) % target_modes.size()
	target_mode = target_modes[next_index]

func _fire(t: Node) -> void:
	if projectile_scene == null:
		print("ERROR: No projectile scene set for tower ", id)
		return
	
	# 공격 애니메이션 시작
	_play_attack_animation()
	
	var p: Node = projectile_scene.instantiate()
	if p == null:
		print("ERROR: Failed to instantiate projectile")
		return
	get_tree().current_scene.add_child(p)
	p.global_position = global_position
	print("Projectile instantiated at position: ", p.global_position)
	if p.has_method("shoot_at"):
		p.shoot_at(t, stats.damage, stats)
		print("Projectile fired from ", global_position, " to ", t.global_position)
	else:
		print("ERROR: Projectile doesn't have shoot_at method")

func upgrade() -> bool:
	if level > upgrades.size():
		return false
	var u: Dictionary = upgrades[level - 1]
	if not gm.spend_gold(u.get("gold", 0)):
		return false
	for k in u.keys():
		if k == "gold" or k == "unlock":
			continue
		stats[k] = u[k]
	if range_area.has_node("CollisionShape2D"):
		var shape2: Shape2D = range_area.get_node("CollisionShape2D").shape
		if shape2 and shape2 is CircleShape2D:
			shape2.radius = stats.range
	level += 1
	return true

func _setup_animations() -> void:
	if not anim_sprite:
		print("No AnimatedSprite2D found for tower ", id)
		return
	
	# Archer 타워는 동적으로 SpriteFrames 생성
	if id == "archer":
		print("Archer tower creating dynamic SpriteFrames")
		_create_archer_sprite_frames()
		return
	
	# 다른 타워들은 동적 SpriteFrames 생성
	var sprite_frames: SpriteFrames = SpriteFrames.new()
	
	# Idle 애니메이션 (2프레임, 반복)
	sprite_frames.add_animation("Idle")
	sprite_frames.set_animation_loop("Idle", true)
	sprite_frames.set_animation_speed("Idle", 4)  # 초당 4프레임
	
	# 타워별 스프라이트 설정
	match id:
		"barracks":
			_create_color_frames(sprite_frames, "Idle", Color(0.8, 0.2, 0.2, 1), Color(0.9, 0.3, 0.3, 1))
		"mage":
			_create_color_frames(sprite_frames, "Idle", Color(0.2, 0.2, 0.8, 1), Color(0.3, 0.3, 0.9, 1))
		"cannon":
			_create_color_frames(sprite_frames, "Idle", Color(0.8, 0.8, 0.2, 1), Color(0.9, 0.9, 0.3, 1))
	
	# Attack 애니메이션 (6프레임, 1회 실행)
	sprite_frames.add_animation("Attack")
	sprite_frames.set_animation_loop("Attack", false)
	sprite_frames.set_animation_speed("Attack", 10)
	
	# 공격 애니메이션 프레임들
	match id:
		"barracks":
			_create_attack_frames(sprite_frames, "Attack", Color(0.8, 0.2, 0.2, 1))
		"mage":
			_create_attack_frames(sprite_frames, "Attack", Color(0.2, 0.2, 0.8, 1))
		"cannon":
			_create_attack_frames(sprite_frames, "Attack", Color(0.8, 0.8, 0.2, 1))
	
	anim_sprite.frames = sprite_frames
	anim_sprite.play("Idle")
	
	# 애니메이션 완료 시그널 연결
	anim_sprite.animation_finished.connect(_on_animation_finished)

func _create_archer_sprite_frames() -> void:
	# Archer 전용 SpriteFrames 생성
	var sprite_frames: SpriteFrames = SpriteFrames.new()
	
	# Idle 애니메이션 (2프레임, 반복)
	sprite_frames.add_animation("Idle")
	sprite_frames.set_animation_loop("Idle", true)
	sprite_frames.set_animation_speed("Idle", 4)  # 초당 4프레임
	
	# Archer 이미지 로드 및 32x32로 리사이즈
	var archer_texture: Texture2D = load("res://sprites/Tower_Archer.png")
	if archer_texture:
		var resized_texture: ImageTexture = _resize_texture_to_32x32(archer_texture)
		if resized_texture:
			sprite_frames.add_frame("Idle", resized_texture)
			sprite_frames.add_frame("Idle", resized_texture)  # 2프레임으로 반복
			print("Archer image loaded and resized to 32x32")
		else:
			_create_color_frames(sprite_frames, "Idle", Color(0.2, 0.8, 0.2, 1), Color(0.3, 0.9, 0.3, 1))
	else:
		# 이미지가 없으면 기본 색상 사용
		_create_color_frames(sprite_frames, "Idle", Color(0.2, 0.8, 0.2, 1), Color(0.3, 0.9, 0.3, 1))
	
	# Attack 애니메이션 (6프레임, 1회 실행)
	sprite_frames.add_animation("Attack")
	sprite_frames.set_animation_loop("Attack", false)
	sprite_frames.set_animation_speed("Attack", 10)
	
	# 공격 애니메이션 프레임들
	if archer_texture:
		var resized_texture: ImageTexture = _resize_texture_to_32x32(archer_texture)
		if resized_texture:
			for i in range(6):
				var intensity: float = 0.5 + (i * 0.1)  # 0.5 ~ 1.0
				var modified_texture: ImageTexture = _modify_texture_color(resized_texture, intensity)
				sprite_frames.add_frame("Attack", modified_texture)
		else:
			_create_attack_frames(sprite_frames, "Attack", Color(0.2, 0.8, 0.2, 1))
	else:
		_create_attack_frames(sprite_frames, "Attack", Color(0.2, 0.8, 0.2, 1))
	
	anim_sprite.frames = sprite_frames
	anim_sprite.play("Idle")
	
	# 애니메이션 완료 시그널 연결
	anim_sprite.animation_finished.connect(_on_animation_finished)

func _create_archer_frames(sprite_frames: SpriteFrames, anim_name: String) -> void:
	# Archer 전용 실제 이미지 사용
	var archer_texture: Texture2D = load("res://sprites/Tower_Archer.png")
	if archer_texture:
		sprite_frames.add_frame(anim_name, archer_texture)
		sprite_frames.add_frame(anim_name, archer_texture)  # 2프레임으로 반복
	else:
		# 이미지가 없으면 기본 색상 사용
		_create_color_frames(sprite_frames, anim_name, Color(0.2, 0.8, 0.2, 1), Color(0.3, 0.9, 0.3, 1))

func _create_archer_attack_frames(sprite_frames: SpriteFrames, anim_name: String) -> void:
	# Archer 공격 애니메이션 (실제 이미지 사용)
	var archer_texture: Texture2D = load("res://sprites/Tower_Archer.png")
	if archer_texture:
		# 6프레임 공격 애니메이션 (색상 변화로 표현)
		for i in range(6):
			var intensity: float = 0.5 + (i * 0.1)  # 0.5 ~ 1.0
			var modified_texture: ImageTexture = _modify_texture_color(archer_texture, intensity)
			sprite_frames.add_frame(anim_name, modified_texture)
	else:
		# 이미지가 없으면 기본 색상 사용
		_create_attack_frames(sprite_frames, anim_name, Color(0.2, 0.8, 0.2, 1))

func _create_color_frames(sprite_frames: SpriteFrames, anim_name: String, color1: Color, color2: Color) -> void:
	# ColorRect를 사용한 간단한 프레임 생성
	var frame1: ImageTexture = _create_color_texture(color1)
	var frame2: ImageTexture = _create_color_texture(color2)
	sprite_frames.add_frame(anim_name, frame1)
	sprite_frames.add_frame(anim_name, frame2)

func _create_attack_frames(sprite_frames: SpriteFrames, anim_name: String, base_color: Color) -> void:
	# 공격 애니메이션용 프레임들 (색상 변화)
	for i in range(6):
		var intensity: float = 0.5 + (i * 0.1)  # 0.5 ~ 1.0
		var attack_color: Color = Color(base_color.r * intensity, base_color.g * intensity, base_color.b * intensity, 1.0)
		var frame: ImageTexture = _create_color_texture(attack_color)
		sprite_frames.add_frame(anim_name, frame)

func _create_color_texture(color: Color) -> ImageTexture:
	var image: Image = Image.create(32, 32, false, Image.FORMAT_RGBA8)
	image.fill(color)
	var texture: ImageTexture = ImageTexture.new()
	texture.create_from_image(image)
	return texture

func _modify_texture_color(texture: Texture2D, intensity: float) -> ImageTexture:
	# 텍스처의 색상을 수정하여 새로운 텍스처 생성
	var image: Image = texture.get_image()
	if image:
		image = image.duplicate()
		image.convert(Image.FORMAT_RGBA8)
		
		# 각 픽셀의 색상을 intensity로 조정
		for x in range(image.get_width()):
			for y in range(image.get_height()):
				var color: Color = image.get_pixel(x, y)
				if color.a > 0:  # 투명하지 않은 픽셀만 수정
					color.r = min(color.r * intensity, 1.0)
					color.g = min(color.g * intensity, 1.0)
					color.b = min(color.b * intensity, 1.0)
					image.set_pixel(x, y, color)
		
		var new_texture: ImageTexture = ImageTexture.new()
		new_texture.create_from_image(image)
		return new_texture
	else:
		# 이미지를 가져올 수 없으면 원본 텍스처 반환
		return texture as ImageTexture

func _play_attack_animation() -> void:
	if anim_sprite and not is_attacking:
		is_attacking = true
		if id == "archer":
			# Archer는 공격 시 Attack 애니메이션 재생
			anim_sprite.play("Attack")
		else:
			anim_sprite.play("Attack")

func _play_archer_attack_effect() -> void:
	# Archer 공격 시 색상 변화 효과
	var tween: Tween = create_tween()
	tween.tween_method(_set_sprite_modulate, Color.WHITE, Color.YELLOW, 0.1)
	tween.tween_method(_set_sprite_modulate, Color.YELLOW, Color.WHITE, 0.1)
	tween.finished.connect(func(): is_attacking = false)

func _resize_texture_to_32x32(texture: Texture2D) -> ImageTexture:
	# 텍스처를 32x32 크기로 조정
	var image: Image = texture.get_image()
	
	if image:
		# 이미지를 32x32로 리사이즈
		image.resize(32, 32, Image.INTERPOLATE_LANCZOS)
		
		# 새로운 텍스처 생성
		var resized_texture: ImageTexture = ImageTexture.new()
		resized_texture.create_from_image(image)
		
		return resized_texture
	else:
		print("Failed to get image from texture")
		return null

func _set_sprite_modulate(color: Color) -> void:
	if anim_sprite:
		anim_sprite.modulate = color

func _on_animation_finished() -> void:
	if anim_sprite.animation == "Attack":
		is_attacking = false
		anim_sprite.play("Idle")
