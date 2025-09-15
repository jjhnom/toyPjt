extends PanelContainer

var turret : Node2D
const sell_modifier := 0.7

func _ready():
	Globals.goldChanged.connect(check_can_upgrade)
	turret.turretUpdated.connect(set_props)
	set_props()
	animate_appear()
	check_can_upgrade()

func animate_appear():
	var tween := create_tween()
	tween.tween_property(self, "position", Vector2(500,0), 0.01).as_relative()
	tween.tween_property(self, "position", Vector2(-500,0), 0.3).as_relative()

func set_props():
	# SpriteFrames인 경우 해당 터렛의 idle 애니메이션 첫 번째 프레임을 사용
	var sprite_resource = load(Data.turrets[turret.turret_type]["sprite"])
	if sprite_resource is SpriteFrames:
		# 해당 터렛의 idle 애니메이션을 사용
		var animation_name = Data.turrets[turret.turret_type]["animation"]
		var first_frame = sprite_resource.get_frame_texture(animation_name, 0)
		%TurretTexture.texture = first_frame
	else:
		%TurretTexture.texture = sprite_resource
	
	%TurretName.text = Data.turrets[turret.turret_type]["name"]
	%TurretLevel.text = "Level "+str(turret.turret_level)
	%UpgradeButton.text = "Upgrade for "+str(get_upgrade_price())
	%SellButton.text = "Sell for "+str(get_sell_price())
	for c in %Stats.get_children():
		c.queue_free()
	var statLabelScene := preload("res://Scenes/ui/turretUI/stat_label.tscn")
	for stat in Data.turrets[turret.turret_type]["stats"].keys():
		var statLabel := statLabelScene.instantiate()
		statLabel.text = Data.stats[stat]["name"]+" "+str(round(turret.get(stat)))
		%Stats.add_child(statLabel)

func _on_upgrade_button_pressed():
	if check_can_upgrade():
		Globals.currentMap.gold -= get_upgrade_price()
		turret.upgrade_turret()
		check_can_upgrade()

func get_upgrade_price():
	return turret.turret_level * Data.turrets[turret.turret_type]["upgrade_cost"]

func get_sell_price():
	var total_cost = Data.turrets[turret.turret_type]["cost"]
	for i in range(turret.turret_level):
		total_cost += i*Data.turrets[turret.turret_type]["upgrade_cost"]
	return round(total_cost * sell_modifier)

func check_can_upgrade(_new_gold=0):
	if turret.turret_level == Data.turrets[turret.turret_type]["max_level"]:
		%UpgradeButton.text = "Maxed Out"
		%UpgradeButton.disabled = true
	else:
		%UpgradeButton.disabled = Globals.currentMap.gold < get_upgrade_price()
	return not %UpgradeButton.disabled


func _on_sell_button_pressed():
	queue_free()
	Globals.currentMap.gold += get_sell_price()
	turret.queue_free()

func _on_close_button_pressed():
	turret.close_details_pane()
