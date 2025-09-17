extends Node2D
class_name PlacementController

@export var tower_scenes := {
	"archer": preload("res://scenes/Tower_Archer.tscn"),
	"barracks": preload("res://scenes/Tower_Barracks.tscn"),
	"mage": preload("res://scenes/Tower_Mage.tscn"),
	"cannon": preload("res://scenes/Tower_Cannon.tscn")
}

@onready var gm: GameManager = $"../GameManager"
@onready var map: Node2D = $"../Map"

var ghost: Node2D
var id: String

func _ready() -> void:
	print("PlacementController ready - Map: ", map)
	if map:
		print("Map has Slots: ", map.has_node("Slots"))
		print("Map has TowerLayer: ", map.has_node("TowerLayer"))
		print("Map global_position: ", map.global_position)
		print("Map position: ", map.position)
		print("Map scale: ", map.scale)
		print("Map transform: ", map.transform)
	else:
		print("ERROR: Map is null!")

func start_drag(_id: String) -> void:
	id = _id
	print("Starting drag for tower: ", id)
	if tower_scenes.has(id):
		ghost = tower_scenes[id].instantiate()
		if ghost == null:
			print("ERROR: Failed to instantiate tower scene")
			return
		ghost.modulate.a = 0.5
		# 초기 위치를 맵 중앙으로 설정
		ghost.global_position = Vector2(360, 640)  # 맵 중앙 근처
		map.add_child(ghost)  # Map의 자식으로 추가
		print("Ghost tower created: ", ghost, " at position: ", ghost.global_position)
		print("Ghost tower parent: ", ghost.get_parent())
	else:
		print("ERROR: Tower scene not found for ID: ", id)
		print("Available towers: ", tower_scenes.keys())

func _input(e: InputEvent) -> void:
	if ghost == null:
		return
	
	# 마우스 이벤트 처리 (데스크톱)
	if e is InputEventMouseMotion:
		# 화면 좌표를 맵 좌표로 변환
		var map_position: Vector2 = map.to_local(e.global_position)
		ghost.position = map_position.snapped(Vector2(32, 32))
		print("Mouse motion: screen=", e.global_position, " map_pos=", map_position, " ghost_local=", ghost.position, " ghost_global=", ghost.global_position)
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
		print("Mouse button released, attempting to place tower")
		_place_or_cancel()
	
	# 터치 이벤트 처리 (모바일)
	elif e is InputEventScreenDrag:
		# 화면 좌표를 맵 좌표로 변환
		var map_position: Vector2 = map.to_local(e.position)
		ghost.position = map_position.snapped(Vector2(32, 32))
	elif e is InputEventScreenTouch and !e.pressed:
		print("Touch released, attempting to place tower")
		_place_or_cancel()

func _place_or_cancel() -> void:
	if not map:
		print("Error: Map is null, cannot place tower")
		ghost.queue_free()
		ghost = null
		return
	
	print("=== TOWER PLACEMENT ATTEMPT ===")
	print("Tower ID: ", id)
	print("Ghost position: ", ghost.global_position)
	print("Map has TowerLayer: ", map.has_node("TowerLayer"))
	print("Map has Slots: ", map.has_node("Slots"))
	
	print("Calling _get_buildable_position with: ", ghost.global_position)
	var buildable_position: Vector2 = _get_buildable_position(ghost.global_position)
	print("_get_buildable_position returned: ", buildable_position)
	var price: int = _price_of(id)
	var can_afford: bool = gm.spend_gold(price)
	
	print("Place attempt:")
	print("  Ghost position: ", ghost.global_position)
	print("  Buildable position: ", buildable_position)
	print("  Price: ", price)
	print("  Can afford: ", can_afford)
	print("  Gold: ", gm.gold)
	
	if buildable_position != Vector2.ZERO and can_afford:
		print("=== TOWER PLACEMENT SUCCESS ===")
		# 고스트 타워를 실제 타워로 변환
		ghost.modulate.a = 1.0
		ghost.visible = true
		ghost.global_position = buildable_position
		
		# 타워 초기화 확인
		if ghost.has_method("_ready"):
			print("Calling tower _ready() method")
			ghost._ready()
		
		# Reparent to TowerLayer if exists
		if map.has_node("TowerLayer"):
			print("Reparenting to TowerLayer")
			var tower_layer: Node2D = map.get_node("TowerLayer")
			print("TowerLayer position: ", tower_layer.global_position)
			print("TowerLayer scale: ", tower_layer.scale)
			ghost.reparent(tower_layer, false)
		else:
			print("TowerLayer not found, reparenting to Map")
			ghost.reparent(map, false)
		
		print("Tower placed successfully at: ", buildable_position)
		print("Tower parent: ", ghost.get_parent())
		print("Tower position: ", ghost.global_position)
		print("Tower local position: ", ghost.position)
		print("Tower children count: ", ghost.get_children().size())
		print("Tower visible: ", ghost.visible)
		print("Tower modulate: ", ghost.modulate)
		
		# 고스트 참조 제거 (타워는 유지)
		ghost = null
		print("=== TOWER PLACEMENT COMPLETE ===")
	else:
		print("=== TOWER PLACEMENT FAILED ===")
		print("Reason: buildable_position=", buildable_position, " can_afford=", can_afford)
		print("Detailed failure analysis:")
		print("  - buildable_position == Vector2.ZERO: ", buildable_position == Vector2.ZERO)
		print("  - can_afford: ", can_afford)
		print("  - ghost position: ", ghost.global_position)
		print("  - price: ", price)
		print("  - current gold: ", gm.gold)
		print("  - map exists: ", map != null)
		print("  - map has Slots: ", map.has_node("Slots") if map else false)
		ghost.queue_free()
		ghost = null

func _get_buildable_position(p: Vector2) -> Vector2:
	print("=== _get_buildable_position called ===")
	print("Input position: ", p)
	
	if not map:
		print("ERROR: Map is null in _get_buildable_position")
		return Vector2.ZERO
		
	# map1.tscn의 Slots 시스템 사용
	var slots: Node2D = map.get_node("Slots") if map.has_node("Slots") else null
	if slots == null:
		print("ERROR: Slots node not found")
		print("Map children: ", map.get_children().map(func(child): return child.name))
		return Vector2.ZERO
	
	print("Slots found, checking buildable position for: ", p)
	print("Slots count: ", slots.get_children().size())
	print("Slots children: ", slots.get_children().map(func(child): return child.name))
	
	# 가장 가까운 슬롯 찾기
	var min_distance: float = INF
	var closest_slot: Area2D = null
	
	for child in slots.get_children():
		if child is Area2D:
			var distance: float = p.distance_to(child.global_position)
			print("  Slot at ", child.global_position, " distance: ", distance)
			if distance < min_distance:
				min_distance = distance
				closest_slot = child
	
	print("Closest slot: ", closest_slot.global_position if closest_slot else "none")
	print("Min distance: ", min_distance)
	
	# 슬롯 반경(80px) 내에 있고, 이미 타워가 없는지 확인
	print("Checking slot availability:")
	print("  - closest_slot exists: ", closest_slot != null)
	print("  - min_distance: ", min_distance)
	print("  - distance <= 80.0: ", min_distance <= 80.0)
	
	if closest_slot and min_distance <= 80.0:
		print("Slot is within range, checking for existing towers...")
		# 이미 타워가 있는지 확인
		var tower_layer: Node2D = map.get_node("TowerLayer") if map.has_node("TowerLayer") else map
		print("TowerLayer children count: ", tower_layer.get_children().size())
		
		for tower in tower_layer.get_children():
			var tower_distance: float = tower.global_position.distance_to(closest_slot.global_position)
			print("  - Tower at ", tower.global_position, " distance to slot: ", tower_distance)
			if tower_distance < 80.0:
				print("ERROR: Slot already occupied by tower at: ", tower.global_position)
				return Vector2.ZERO
		
		print("SUCCESS: Slot is available, returning: ", closest_slot.global_position)
		return closest_slot.global_position
	
	print("ERROR: No suitable slot found (distance too far: ", min_distance, ")")
	return Vector2.ZERO

func _price_of(_id: String) -> int:
	var datahub: DataHub = $"../DataHub"
	return datahub.towers.get(_id, {}).get("price", 50)
