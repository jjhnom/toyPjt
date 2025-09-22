extends Node2D

# A character-based tower script that handles range detection, attack timing,
# projectile spawning and animation control.  This script fixes issues where
# towers would sometimes fail to attack enemies in range by unifying the
# detection radius and effective attack radius, filtering targets consistently,
# preventing duplicate entries in the in_range list and ensuring that attack
# animations are detected properly even when their names include direction
# suffixes (e.g. "attack_right").

@export var range: float = 120.0
@export var damage: int = 12
@export var rate: float = 0.8
@export var projectile_scene: PackedScene

var level: int = 1
var id: String = "archer"
var cd: float = 0.0
var in_range: Array = []
var is_attacking: bool = false
var last_target: Node = null

@onready var area: Area2D = $RangeArea
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
var level_label: Label = null

# Character animation defaults
@export var anim_name := "idle"
@export var fps := 8.0

# Cache for sprite frames to avoid rebuilding animations each time
var _frames_cache: Dictionary = {}

##
## Initialisation
##

# Initialise the tower from a configuration dictionary.  The dictionary is
# expected to come from a JSON definition (e.g. towers.json) and may
# contain keys such as `atk`, `range`, `rate`, `sprite_path` and `scale`.
func init_from_config(conf: Dictionary, _level: int, _id: String) -> void:
	id = _id
	level = _level

	# Apply stat scaling based on level.  Damage increases linearly,
	# range increases linearly and rate decreases (i.e. attack speeds up)
	damage = conf.get("atk", damage) + (level - 1) * 4
	range = conf.get("range", range) + (level - 1) * 12
	rate = conf.get("rate", rate) * max(0.5, 1.0 - (level - 1) * 0.08)

	# Adjust the Area2D collision radius.  We set the radius slightly larger
	# than the logical range so that enemies entering the detection area will
	# always be considered within effective range when firing.  A small
	# constant margin is added instead of the overly large slot buffer from
	# earlier versions.
	var shape: CollisionShape2D = area.get_node("CollisionShape2D")
	if shape and shape.shape is CircleShape2D:
		shape.shape.radius = range + 24.0  # 24 pixels of margin

	# Load the sprite from the provided path or fall back to a backup
	var sprite_path = conf.get("sprite_path", "")
	if sprite_path != "":
		_set_character_sprite_from_path(sprite_path)
	else:
		_set_character_sprite_backup(_id)

	# Apply scaling based on the configuration and the current level
	var base_scale = conf.get("scale", 1.0)
	var level_scale_bonus = (level - 1) * 0.1
	var final_scale = base_scale + level_scale_bonus
	if sprite:
		sprite.scale = Vector2(final_scale, final_scale)

	# Update level label and show a level-up effect if needed
	_update_level_label()
	if level > 1:
		_show_levelup_effect()


##
## Lifecycle callbacks
##

func _ready() -> void:
	# Ensure sprite is assigned
	if not sprite:
		sprite = get_node("AnimatedSprite2D")

	# Connect the animation finished signal to handle the end of attack
	if sprite:
		sprite.animation_finished.connect(_on_animation_finished)

	# Track enemies entering and leaving the detection area
	area.area_entered.connect(_on_area_enter)
	area.area_exited.connect(_on_area_exit)

	# Create the level display label
	_create_level_label()


##
## Detection callbacks
##

func _on_area_enter(area: Area2D) -> void:
	# When an enemy's hitbox area enters, add it to the in_range list if
	# applicable.  Duplicate entries are avoided by checking the list first.
	var enemy = area.get_parent()
	if enemy and enemy.has_method("take_damage"):
		if in_range.find(enemy) == -1:
			in_range.append(enemy)

func _on_area_exit(area: Area2D) -> void:
	# Remove the enemy from the in_range list when it leaves the area
	var enemy = area.get_parent()
	in_range.erase(enemy)


##
## Main update loop
##

func _process(delta: float) -> void:
	# Cooldown decrement
	cd = max(cd - delta, 0.0)

	# Prune invalid references from the in_range list
	in_range = in_range.filter(is_instance_valid)

	# Determine which enemies are actually within effective range.
	var valid_targets: Array = []
	for enemy in in_range:
		if global_position.distance_to(enemy.global_position) <= _effective_range(enemy):
			valid_targets.append(enemy)

	# If no valid targets remain, reset attacking state and play idle animation
	if valid_targets.is_empty():
		if is_attacking:
			is_attacking = false
			last_target = null
			play_idle_animation()
		return

	# Respect attack cooldown only (allow attacking during animation)
	if cd > 0.0:
		return

	# Choose a target (closest by default) and fire
	var target: Node = _get_closest_target(valid_targets)
	if target:
		_fire(target)
		cd = rate


##
## Target selection and range computations
##

func _enemy_effective_radius(enemy: Node) -> float:
	# Combine the enemy's hitbox radius and visual sprite radius to avoid
	# clipping issues.  A default radius is used if none are found.
	var enemy_hitbox_radius: float = 16.0
	var enemy_area = enemy.get_node_or_null("HitboxArea")
	if enemy_area:
		var enemy_collision = enemy_area.get_node_or_null("CollisionShape2D")
		if enemy_collision and enemy_collision.shape is CircleShape2D:
			enemy_hitbox_radius = enemy_collision.shape.radius

	var enemy_image_radius: float = 0.0
	var enemy_sprite = enemy.get_node_or_null("AnimatedSprite2D")
	if enemy_sprite:
		# Assume square sprite frames of 64px and scale accordingly
		var base_size: float = 64.0
		enemy_image_radius = (base_size * enemy_sprite.scale.x) / 2.0

	return enemy_hitbox_radius + enemy_image_radius

func _effective_range(enemy: Node) -> float:
	# Attack range plus the enemy's effective radius and a small margin
	return range + _enemy_effective_radius(enemy) + 5.0

func _get_closest_target(targets: Array) -> Node:
	if targets.is_empty():
		return null
	var closest: Node = targets[0]
	var closest_distance: float = global_position.distance_to(closest.global_position)
	for t in targets:
		var dist = global_position.distance_to(t.global_position)
		if dist < closest_distance:
			closest = t
			closest_distance = dist
	return closest


##
## Firing logic
##

func _fire(t: Node) -> void:
	# Validate target and distance
	if not is_instance_valid(t):
		return
	var dist: float = global_position.distance_to(t.global_position)
	if dist > _effective_range(t):
		return

	# Mark as attacking and remember the target
	is_attacking = true
	last_target = t

	# Trigger the appropriate attack animation
	if id == "lancer":
		play_lancer_attack_towards_target(t)
	else:
		play_attack_animation()

	# Wait one frame to ensure the animation is applied before checking
	await get_tree().process_frame
	
	if is_attacking and sprite:
		var anim_name = sprite.animation.to_lower()
		if not ("attack" in anim_name or anim_name == "attack" or anim_name == "heal"):
			# Fallback: ensure attacking state resets if animation wasn't set
			is_attacking = false

	# Spawn a projectile and direct it at the target
	# Double-check target validity before creating projectile
	if not is_instance_valid(t):
		is_attacking = false
		last_target = null
		return
	
	var ps = projectile_scene if projectile_scene != null else preload("res://scenes/Projectile.tscn")
	var bullet: Node = ps.instantiate()
	# Use the tower's parent (e.g. Towers layer) as the container for bullets
	var parent: Node = get_parent()
	parent.add_child(bullet)
	bullet.global_position = global_position
	if bullet.has_method("shoot_at"):
		# Pass target and damage to the projectile's shoot_at method
		bullet.shoot_at(t, damage)

	# The attack cooldown will be handled in _process by resetting cd


##
## Animation callbacks
##

func _on_animation_finished() -> void:
	# When an attack animation finishes, reset state and return to idle
	print("%s: 애니메이션 완료 - 현재 애니메이션: %s, attacking: %s" % [id, sprite.animation if sprite else "none", is_attacking])
	if sprite and is_attacking:
		# Check if current animation is an attack animation
		var anim_name = sprite.animation.to_lower()
		if "attack" in anim_name or anim_name == "attack" or anim_name == "heal":
			print("%s: 공격 애니메이션 완료 - idle 전환 (애니메이션: %s)" % [id, anim_name])
			is_attacking = false
			last_target = null
			play_idle_animation()
		else:
			print("%s: 공격 애니메이션이 아님 - 유지 (애니메이션: %s)" % [id, anim_name])
			# 공격 애니메이션이 아닌 경우 유지
			pass


##
## Sprite loading and animation helpers
##

func _set_character_sprite_from_path(sprite_path: String) -> void:
	if sprite:
		_setup_animation(sprite_path)

func _setup_animation(sprite_strip_path: String) -> void:
	if not sprite:
		return
	# Determine the animation name from the file path
	var animation_name: String = _get_animation_name_from_path(sprite_strip_path)
	var cache_key: String = sprite_strip_path + "_" + animation_name
	# Use cached frames if available
	if _frames_cache.has(cache_key):
		sprite.sprite_frames = _frames_cache[cache_key]
		sprite.animation = animation_name
		sprite.play()
		return
	# Load the sprite sheet
	var tex: Texture2D = load(sprite_strip_path)
	if not tex:
		return
	var frames: SpriteFrames = SpriteFrames.new()
	frames.add_animation(animation_name)
	# Determine frames per second from character config
	var animation_fps: float = _get_animation_fps(animation_name)
	frames.set_animation_speed(animation_name, animation_fps)
	var frame_width: int
	var frame_height: int
	var cols: int
	var rows: int

	# Heuristically determine the frame grid.  First attempt to guess
	# using the aspect ratio and then fall back to defaults.  Special
	# handling for certain names (Monk, legacy Archer) is preserved.
	frame_height = tex.get_height()
	var aspect_ratio: float = float(tex.get_width()) / float(tex.get_height())
	var possible_frames = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
	cols = 1
	for frame_count in possible_frames:
		var calculated_width: float = float(tex.get_width()) / float(frame_count)
		var width_error: float = abs(calculated_width - int(calculated_width))
		if width_error < 0.1 and abs(aspect_ratio - frame_count) < 0.5:
			cols = frame_count
			break
	if cols == 1:
		if aspect_ratio >= 11.7:
			cols = 12
		elif aspect_ratio >= 10.7:
			cols = 11
		elif aspect_ratio >= 9.7:
			cols = 10
		elif aspect_ratio >= 8.7:
			cols = 9
		elif aspect_ratio >= 7.7:
			cols = 8
		elif aspect_ratio >= 6.7:
			cols = 7
		elif aspect_ratio >= 5.7:
			cols = 6
		elif aspect_ratio >= 4.7:
			cols = 5
		elif aspect_ratio >= 3.7:
			cols = 4
		elif aspect_ratio >= 2.7:
			cols = 3
		elif aspect_ratio >= 1.7:
			cols = 2
		else:
			cols = 1
	frame_width = tex.get_width() / cols
	rows = 1
	# Special-case handling for certain character sheets
	if sprite_strip_path.contains("Monk"):
		frame_height = tex.get_height()
		if sprite_strip_path.contains("Heal") and not sprite_strip_path.contains("Effect"):
			frame_width = tex.get_width() / 11
			cols = 11
		else:
			frame_width = tex.get_width() / 6
			cols = 6
		rows = 1
	elif sprite_strip_path.ends_with("archer.png"):
		frame_width = 192
		frame_height = 512
		cols = 8
		rows = 2
	else:
		frame_height = tex.get_height()
		frame_width = frame_height
		cols = int(tex.get_width() / float(frame_width))
		rows = 1
	# Extract frames into the animation
	for row in range(rows):
		for col in range(cols):
			var atlas: AtlasTexture = AtlasTexture.new()
			atlas.atlas = tex
			atlas.region = Rect2(col * frame_width, row * frame_height, frame_width, frame_height)
			frames.add_frame(animation_name, atlas)
	# Cache and apply
	_frames_cache[cache_key] = frames
	sprite.sprite_frames = frames
	sprite.animation = animation_name
	sprite.play()

func _get_animation_name_from_path(sprite_path: String) -> String:
	var filename = sprite_path.get_file().get_basename().to_lower()
	if "attack" in filename or "shoot" in filename:
		return "attack"
	elif "heal" in filename:
		return "heal"
	elif "run" in filename:
		return "run"
	elif "guard" in filename or "defence" in filename:
		return "guard"
	else:
		return "idle"

func _get_animation_fps(animation_name: String) -> float:
	# Try to look up a configured FPS for the given animation from a character
	# configuration.  If none exists, default to 8 FPS.
	var config = _get_character_config()
	var animations = config.get("animations", {})
	var anim_data = animations.get(animation_name, {"fps": 8.0})
	return anim_data.get("fps", 8.0)

func _set_character_sprite_backup(character_id: String) -> void:
	# Provide fallback sprites when none are specified in the configuration.
	var backup_sprites = {
		"archer": "res://assets/turrets/archer_96x96_sheet_96_transparent.png",
		"knight": "res://assets/turrets/archer_96x96_sheet_96_transparent.png",
		"mage": "res://assets/turrets/archer_96x96_sheet_96_transparent.png",
		"cleric": "res://assets/turrets/archer_96x96_sheet_96_transparent.png"
	}
	var texture_path = backup_sprites.get(character_id, "res://assets/turrets/archer_96x96_sheet_96_transparent.png")
	_set_character_sprite_from_path(texture_path)

func play_attack_animation() -> void:
	# Choose an appropriate attack animation based on the character configuration
	var config = _get_character_config()
	
	if id == "lancer":
		_play_lancer_directional_attack(config)
	elif config.has("attack_sprite"):
		_set_character_sprite_from_path(config.attack_sprite)
	elif config.has("attack2_sprite") and randf() > 0.5:
		_set_character_sprite_from_path(config.attack2_sprite)
	else:
		# Fall back to idle when no attack sprite is specified
		play_idle_animation()

func _play_lancer_directional_attack(config: Dictionary) -> void:
	# Lancer characters have directional attack sprites.  Select one at random.
	var directions = ["right", "down", "up", "downright", "upright"]
	var selected_direction = directions[randi() % directions.size()]
	var attack_key = "attack_" + selected_direction
	if config.has(attack_key):
		_set_character_sprite_from_path(config[attack_key])
	elif config.has("attack_sprite"):
		_set_character_sprite_from_path(config.attack_sprite)

func play_lancer_attack_towards_target(target: Node) -> void:
	var config = _get_character_config()
	if not target:
		_play_lancer_directional_attack(config)
		return
	var direction_to_target = target.global_position - global_position
	var selected_direction = _get_direction_name(direction_to_target)
	var attack_key = "attack_" + selected_direction
	if not config.has(attack_key):
		match selected_direction:
			"downleft": selected_direction = "down"
			"left": selected_direction = "right"
			"upleft": selected_direction = "up"
		attack_key = "attack_" + selected_direction
	if config.has(attack_key):
		_set_character_sprite_from_path(config[attack_key])
	elif config.has("attack_sprite"):
		_set_character_sprite_from_path(config.attack_sprite)

func _get_direction_name(direction: Vector2) -> String:
	# Convert a direction vector into an eight-direction name
	direction = direction.normalized()
	var angle = direction.angle()
	var degrees = rad_to_deg(angle)
	if degrees < 0:
		degrees += 360
	if degrees >= 337.5 or degrees < 22.5:
		return "right"
	elif degrees >= 22.5 and degrees < 67.5:
		return "downright"
	elif degrees >= 67.5 and degrees < 112.5:
		return "down"
	elif degrees >= 112.5 and degrees < 157.5:
		return "downleft"
	elif degrees >= 157.5 and degrees < 202.5:
		return "left"
	elif degrees >= 202.5 and degrees < 247.5:
		return "upleft"
	elif degrees >= 247.5 and degrees < 292.5:
		return "up"
	else:
		return "upright"


##
## Level label management
##

func _create_level_label() -> void:
	if level_label:
		return  # Already created
	level_label = Label.new()
	level_label.name = "LevelLabel"
	level_label.text = "Lv.%d" % level
	level_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var label_settings = LabelSettings.new()
	label_settings.font_size = 14
	label_settings.font_color = Color.WHITE
	label_settings.outline_size = 2
	label_settings.outline_color = Color.BLACK
	level_label.label_settings = label_settings
	level_label.size = Vector2(40, 20)
	level_label.position = Vector2(-20, -60)
	add_child(level_label)

func _update_level_label() -> void:
	if not level_label:
		_create_level_label()
		return
	level_label.text = "Lv.%d" % level


##
## Idle/run/special animations
##

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

func _show_levelup_effect() -> void:
	# Simple colour flash effect when the tower levels up
	if sprite:
		var original_modulate = sprite.modulate
		var tween = create_tween()
		tween.set_loops(3)
		tween.tween_property(sprite, "modulate", Color.GOLD, 0.2)
		tween.tween_property(sprite, "modulate", original_modulate, 0.2)


##
## DataHub lookup helper
##

func _get_character_config() -> Dictionary:
	# Attempt to locate a DataHub node to retrieve character-specific data
	var data_hub = get_node_or_null("/root/Main/GameManager/DataHub")
	if not data_hub:
		data_hub = get_node_or_null("/root/Main/DataHub")
	if not data_hub:
		data_hub = get_node_or_null("../../../GameManager/DataHub")
	if data_hub and data_hub.has_method("get_character_data"):
		return data_hub.get_character_data(id)
	return {}
