extends CharacterBody2D
class_name Enemy

signal died(reward: int)
signal escaped

var hp: float
var speed: float
var reward: int
var resists: Dictionary = {}
var regen: float = 0.0
var revive: float = 0.0
var flying: bool = false
var aura: Dictionary = {}

var path_curve: Curve2D
var path_points: PackedVector2Array
var t: float = 0.0

func init_from_config(conf: Dictionary) -> void:
	hp     = conf.get("hp", 50)
	speed  = conf.get("speed", 100)
	reward = conf.get("reward", 5)
	resists= conf.get("res", {})
	regen  = conf.get("regen", 0.0)
	revive = conf.get("revive", 0.0)
	flying = conf.get("flying", false)
	aura   = conf.get("aura", {})

func begin_move_on_path(path: Path2D) -> void:
	path_curve = path.curve
	t = 0.0

func begin_move_on_points(points: PackedVector2Array) -> void:
	path_points = points
	t = 0.0

func _physics_process(delta: float) -> void:
	if path_curve:
		t += (speed * delta) / path_curve.get_baked_length()
		if t >= 1.0:
			emit_signal("escaped")
			queue_free()
			return
		var pos: Vector2 = path_curve.sample_baked(t)
		global_position = pos
	elif path_points.size() > 0:
		# 점들 사이를 선형 보간으로 이동
		var total_length: float = 0.0
		for i in range(path_points.size() - 1):
			total_length += path_points[i].distance_to(path_points[i + 1])
		
		t += (speed * delta) / total_length
		if t >= 1.0:
			emit_signal("escaped")
			queue_free()
			return
		
		var pos: Vector2 = _interpolate_path_points(t)
		global_position = pos
	
	if regen > 0:
		hp = hp + regen * delta

func _interpolate_path_points(t: float) -> Vector2:
	if path_points.size() < 2:
		return path_points[0] if path_points.size() > 0 else Vector2.ZERO
	
	var segment_length: float = 1.0 / (path_points.size() - 1)
	var segment_index: int = int(t / segment_length)
	var local_t: float = (t - segment_index * segment_length) / segment_length
	
	segment_index = min(segment_index, path_points.size() - 2)
	
	return path_points[segment_index].lerp(path_points[segment_index + 1], local_t)

func take_damage(dmg: int, dmg_type: String = "phys") -> void:
	var resistance: float = resists.get(dmg_type, 0.0)
	hp -= dmg * (1.0 - resistance)
	if hp <= 0:
		if revive > 0 and randi() % 100 < int(revive * 100):
			hp = 1  # revive with 1 hp
			revive = 0.0
			return
		emit_signal("died", reward)
		queue_free()
