extends Node
class_name WaveManager

signal wave_started(id: int)
signal wave_cleared(id: int)

@onready var data: DataHub = $"../DataHub"
@onready var map: Node2D = $"../Map"
@onready var gm: GameManager = $"../GameManager"

var idx: int = -1
var alive: int = 0

func _ready() -> void:
	print("WaveManager ready - Map: ", map)
	if map:
		print("Map has Path (Line2D): ", map.has_node("Path"))
		print("Map has EnemyLayer: ", map.has_node("EnemyLayer"))
		if map.has_node("Path"):
			var line2d: Line2D = map.get_node("Path")
			print("Path points count: ", line2d.points.size())
	else:
		print("ERROR: Map is null!")

func start_next_wave() -> void:
	idx += 1
	var list: Array = data.waves.get("list", [])
	if idx >= list.size():
		emit_signal("wave_cleared", idx)
		return
	emit_signal("wave_started", idx + 1)
	await _spawn_wave(list[idx])
	await _wait_until_clear()
	emit_signal("wave_cleared", idx + 1)

func _spawn_wave(w: Dictionary) -> void:
	var route_name: String = w.get("route", "A")
	var path_points: PackedVector2Array = []
	
	# map1.tscn의 Line2D 경로 사용
	if map and map.has_node("Path"):
		var line2d: Line2D = map.get_node("Path")
		path_points = line2d.points
	
	var groups: Array = w.get("groups", [])
	for g in groups:
		var count: int = g.get("count", 1)
		for i in range(count):
			var interval: float = g.get("interval", 0.6)
			await get_tree().create_timer(interval).timeout
			var enemy_type: String = g.get("enemy", "goblin")
			_spawn_one(enemy_type, path_points)

func _spawn_one(enemy_id: String, path_points: PackedVector2Array) -> void:
	if not map:
		print("Error: Map is null, cannot spawn enemy")
		return
		
	var e: CharacterBody2D = preload("res://scenes/Enemy.tscn").instantiate()
	if map.has_node("EnemyLayer"):
		map.get_node("EnemyLayer").add_child(e)
	else:
		map.add_child(e)
	
	# 적 초기 위치를 경로 시작점으로 설정
	if path_points.size() > 0:
		e.global_position = path_points[0]
	
	e.init_from_config(data.enemies.get(enemy_id, {}))
	if path_points.size() > 0:
		e.begin_move_on_points(path_points)
	
	print("Enemy spawned: ", enemy_id, " at position: ", e.global_position)
	
	e.died.connect(func(reward: int):
		gm.add_gold(reward)
		alive -= 1
	)
	e.escaped.connect(func():
		gm.damage_life(1)
		alive -= 1
	)
	alive += 1

func _wait_until_clear() -> void:
	while alive > 0:
		await get_tree().process_frame
