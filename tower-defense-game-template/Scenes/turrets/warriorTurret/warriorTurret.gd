extends Turret

func _ready():
	# idle 애니메이션을 정적으로 표시 (루프하지 않음)
	$AnimatedSprite2D.play(Data.turrets[turret_type]["animation"])
	$AnimatedSprite2D.pause()

func attack():
	if is_instance_valid(current_target):
		# 공격 애니메이션 재생
		$AnimatedSprite2D.play(Data.turrets[turret_type]["attack_animation"])
		
		# 전사는 근접 공격으로 범위 내 모든 적에게 데미지를 줍니다
		for a in $DetectionArea.get_overlapping_areas():
			var collider = a.get_parent()
			if collider.is_in_group("enemy"):
				collider.get_damage(damage)
	else:
		try_get_closest_target()

func _on_animated_sprite_2d_animation_finished():
	# 공격 애니메이션이 끝나면 idle 애니메이션으로 돌아가기 (정적으로)
	if $AnimatedSprite2D.animation == Data.turrets[turret_type]["attack_animation"]:
		$AnimatedSprite2D.play(Data.turrets[turret_type]["animation"])
		$AnimatedSprite2D.pause()
