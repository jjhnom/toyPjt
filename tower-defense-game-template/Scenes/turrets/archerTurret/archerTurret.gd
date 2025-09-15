extends Turret

var bulletSpeed := 300.0
var bulletPierce := 1

func _ready():
	# idle 애니메이션을 정적으로 표시 (루프하지 않음)
	$AnimatedSprite2D.play(Data.turrets[turret_type]["animation"])
	$AnimatedSprite2D.pause()

func attack():
	if is_instance_valid(current_target):
		# 공격 애니메이션 재생
		$AnimatedSprite2D.play(Data.turrets[turret_type]["attack_animation"])
		
		var projectileScene := preload("res://Scenes/turrets/projectileTurret/bullet/bulletBase.tscn")
		var projectile := projectileScene.instantiate()
		projectile.bullet_type = Data.turrets[turret_type]["bullet"]
		projectile.damage = damage
		projectile.speed = bulletSpeed
		projectile.pierce = bulletPierce
		Globals.projectilesNode.add_child(projectile)
		projectile.position = position
		projectile.target = current_target.position
	else:
		try_get_closest_target()

func _on_animated_sprite_2d_animation_finished():
	# 공격 애니메이션이 끝나면 idle 애니메이션으로 돌아가기 (정적으로)
	if $AnimatedSprite2D.animation == Data.turrets[turret_type]["attack_animation"]:
		$AnimatedSprite2D.play(Data.turrets[turret_type]["animation"])
		$AnimatedSprite2D.pause()
