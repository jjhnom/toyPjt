extends PanelContainer

var turret_type := "":
	set(value):
		turret_type = value
		$TextureRect.turretType = value
		
		# SpriteFrames인 경우 해당 터렛의 idle 애니메이션 첫 번째 프레임을 사용
		var sprite_resource = load(Data.turrets[value]["sprite"])
		if sprite_resource is SpriteFrames:
			# 해당 터렛의 idle 애니메이션을 사용
			var animation_name = Data.turrets[value]["animation"]
			var first_frame = sprite_resource.get_frame_texture(animation_name, 0)
			$TextureRect.texture = first_frame
		else:
			$TextureRect.texture = sprite_resource
		
		$CostLabel.text = str(Data.turrets[value]["cost"])

var can_purchase := false:
	set(value):
		can_purchase = value
		$CantBuy.visible = not value
