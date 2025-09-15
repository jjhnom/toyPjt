extends CanvasLayer

@onready var player = get_tree().current_scene.get_node("Player")
@onready var hud = get_tree().current_scene.get_node("HUD")

var upgrade_costs = {
	"damage": 50,
	"speed": 40,
	"range": 60
}

var upgrade_amounts = {
	"damage": 10,
	"speed": 0.1,
	"range": 50
}

func _ready():
	# 업그레이드 버튼들 생성
	create_upgrade_buttons()

func create_upgrade_buttons():
	# 공격력 업그레이드 버튼
	var damage_button = create_button("공격력 +10 (%d골드)" % upgrade_costs["damage"], Vector2(20, 400))
	damage_button.pressed.connect(_on_damage_upgrade_pressed)
	
	# 공격속도 업그레이드 버튼
	var speed_button = create_button("공격속도 +0.1초 (%d골드)" % upgrade_costs["speed"], Vector2(20, 450))
	speed_button.pressed.connect(_on_speed_upgrade_pressed)
	
	# 사거리 업그레이드 버튼
	var range_button = create_button("사거리 +50 (%d골드)" % upgrade_costs["range"], Vector2(20, 500))
	range_button.pressed.connect(_on_range_upgrade_pressed)
	
	# 스탯 표시 라벨
	var stats_label = Label.new()
	stats_label.position = Vector2(20, 350)
	stats_label.text = "현재 스탯:\n공격력: 25\n공격속도: 0.5초\n사거리: 800"
	add_child(stats_label)

func create_button(text, pos):
	var button = Button.new()
	button.text = text
	button.position = pos
	button.size = Vector2(250, 40)
	add_child(button)
	return button

func _on_damage_upgrade_pressed():
	if hud and hud.spend_gold(upgrade_costs["damage"]):
		player.upgrade_attack_damage(upgrade_amounts["damage"])
		upgrade_costs["damage"] += 10  # 다음 업그레이드 비용 증가
		update_hud_stats()
		print("공격력 업그레이드 완료! 비용: %d골드" % (upgrade_costs["damage"] - 10))
	else:
		print("골드가 부족합니다! 필요: %d골드" % upgrade_costs["damage"])

func _on_speed_upgrade_pressed():
	if hud and hud.spend_gold(upgrade_costs["speed"]):
		player.upgrade_attack_speed(upgrade_amounts["speed"])
		upgrade_costs["speed"] += 5  # 다음 업그레이드 비용 증가
		update_hud_stats()
		print("공격속도 업그레이드 완료! 비용: %d골드" % (upgrade_costs["speed"] - 5))
	else:
		print("골드가 부족합니다! 필요: %d골드" % upgrade_costs["speed"])

func _on_range_upgrade_pressed():
	if hud and hud.spend_gold(upgrade_costs["range"]):
		player.upgrade_attack_range(upgrade_amounts["range"])
		upgrade_costs["range"] += 15  # 다음 업그레이드 비용 증가
		update_hud_stats()
		print("사거리 업그레이드 완료! 비용: %d골드" % (upgrade_costs["range"] - 15))
	else:
		print("골드가 부족합니다! 필요: %d골드" % upgrade_costs["range"])

# HUD 스탯 업데이트
func update_hud_stats():
	if player and hud:
		var stats = player.get_stats()
		hud.update_player_stats(stats["damage"], stats["cooldown"], stats["range"])
