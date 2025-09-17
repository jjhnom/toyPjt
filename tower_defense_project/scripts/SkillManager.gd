extends Node
class_name SkillManager

signal skill_used(skill_id: String)
signal skill_cooldown_updated(skill_id: String, remaining: float)

@onready var gm: GameManager = $"../GameManager"
@onready var data: DataHub = $"../DataHub"
@onready var map: Node2D = $"../Map"

var skill_cooldowns: Dictionary = {}
var skill_durations: Dictionary = {}

func _ready() -> void:
	# 스킬 쿨다운 초기화
	for skill_id in data.skills.keys():
		skill_cooldowns[skill_id] = 0.0
		skill_durations[skill_id] = 0.0

func _process(delta: float) -> void:
	# 쿨다운 업데이트
	for skill_id in skill_cooldowns.keys():
		if skill_cooldowns[skill_id] > 0:
			skill_cooldowns[skill_id] -= delta
			emit_signal("skill_cooldown_updated", skill_id, skill_cooldowns[skill_id])
		
		if skill_durations[skill_id] > 0:
			skill_durations[skill_id] -= delta

func can_use_skill(skill_id: String) -> bool:
	var skill_data: Dictionary = data.skills.get(skill_id, {})
	var cost: int = skill_data.get("cost", 0)
	var cooldown: float = skill_data.get("cooldown", 0)
	
	return (gm.mana >= cost and 
			skill_cooldowns[skill_id] <= 0 and 
			skill_durations[skill_id] <= 0)

func use_skill(skill_id: String, target_position: Vector2 = Vector2.ZERO) -> bool:
	if not can_use_skill(skill_id):
		return false
	
	var skill_data: Dictionary = data.skills.get(skill_id, {})
	var cost: int = skill_data.get("cost", 0)
	var cooldown: float = skill_data.get("cooldown", 0)
	
	# 마나 소모
	if not gm.spend_mana(cost):
		return false
	
	# 쿨다운 설정
	skill_cooldowns[skill_id] = cooldown
	
	# 스킬 실행
	match skill_id:
		"arrow_rain":
			_execute_arrow_rain(target_position, skill_data)
		"knight_charge":
			_execute_knight_charge(target_position, skill_data)
		"heal_gate":
			_execute_heal_gate(skill_data)
	
	emit_signal("skill_used", skill_id)
	return true

func _execute_arrow_rain(target_position: Vector2, skill_data: Dictionary) -> void:
	var aoe_radius: float = skill_data.get("aoe", 160)
	var damage: int = skill_data.get("damage", 120)
	
	# 범위 내 모든 적에게 데미지
	var enemies: Array = _get_enemies_in_radius(target_position, aoe_radius)
	for enemy in enemies:
		if enemy.has_method("take_damage"):
			enemy.take_damage(damage, "phys")
	
	# 화살비 이펙트 (시각적 효과)
	_create_arrow_rain_effect(target_position, aoe_radius)

func _execute_knight_charge(target_position: Vector2, skill_data: Dictionary) -> void:
	var duration: float = skill_data.get("duration", 6)
	var block: bool = skill_data.get("block", true)
	
	# 기사 소환 (일시적으로 길을 막는 강력한 유닛)
	var knight: Node2D = _create_knight_unit(target_position)
	if knight:
		skill_durations["knight_charge"] = duration
		# 기사가 duration 시간 후 사라지도록 설정
		await get_tree().create_timer(duration).timeout
		if is_instance_valid(knight):
			knight.queue_free()

func _execute_heal_gate(skill_data: Dictionary) -> void:
	var heal_amount: int = skill_data.get("heal", 20)
	gm.heal_life(heal_amount)

func _get_enemies_in_radius(center: Vector2, radius: float) -> Array:
	var enemies: Array = []
	var enemy_layer: Node = map.get_node("EnemyLayer") if map.has_node("EnemyLayer") else map
	
	for child in enemy_layer.get_children():
		if child.has_method("take_damage") and child.global_position.distance_to(center) <= radius:
			enemies.append(child)
	
	return enemies

func _create_arrow_rain_effect(position: Vector2, radius: float) -> void:
	# 화살비 시각적 이펙트 생성 (간단한 원형 표시)
	var effect: Node2D = Node2D.new()
	map.add_child(effect)
	effect.global_position = position
	
	# 원형 표시 (실제로는 파티클 시스템이나 애니메이션 사용)
	var circle: ColorRect = ColorRect.new()
	circle.size = Vector2(radius * 2, radius * 2)
	circle.position = Vector2(-radius, -radius)
	circle.color = Color(1, 1, 0, 0.3)  # 반투명 노란색
	effect.add_child(circle)
	
	# 1초 후 이펙트 제거
	await get_tree().create_timer(1.0).timeout
	if is_instance_valid(effect):
		effect.queue_free()

func _create_knight_unit(position: Vector2) -> Node2D:
	# 기사 유닛 생성 (간단한 구현)
	var knight: CharacterBody2D = CharacterBody2D.new()
	knight.global_position = position
	
	# 기사의 시각적 표현
	var sprite: ColorRect = ColorRect.new()
	sprite.size = Vector2(32, 32)
	sprite.color = Color(0.2, 0.2, 0.8)  # 파란색 기사
	knight.add_child(sprite)
	
	# 충돌 영역
	var collision: CollisionShape2D = CollisionShape2D.new()
	var shape: RectangleShape2D = RectangleShape2D.new()
	shape.size = Vector2(32, 32)
	collision.shape = shape
	knight.add_child(collision)
	
	map.add_child(knight)
	return knight
