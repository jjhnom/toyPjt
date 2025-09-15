extends Node2D

var tower_scene = preload("res://scenes/Tower.tscn")
var selected_tower_type = "basic"
var tower_costs = {
	"basic": 50,
	"rapid": 75,
	"heavy": 100
}

func _ready():
	# 타워 매니저 그룹에 추가
	add_to_group("tower_manager")

func _input(event):
	# 마우스 클릭으로 타워 건설
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		var mouse_pos = get_global_mouse_position()
		build_tower(mouse_pos)

func build_tower(pos):
	# 타워 건설 비용 확인
	var cost = tower_costs.get(selected_tower_type, 50)
	var main = get_tree().current_scene
	if main and main.hud and main.hud.current_gold >= cost:
		# 골드 차감
		main.hud.spend_gold(cost)
		
		# 타워 생성
		var tower = tower_scene.instantiate()
		get_tree().current_scene.add_child(tower)
		tower.position = pos
		
		print("타워 건설 완료: %s 타워 (비용: %d골드)" % [selected_tower_type, cost])
	else:
		print("골드가 부족합니다! 필요: %d골드" % cost)

func set_tower_type(type):
	selected_tower_type = type
	print("선택된 타워 타입: %s" % type)
