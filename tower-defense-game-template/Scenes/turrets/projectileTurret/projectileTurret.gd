extends Turret

var bulletSpeed := 200.0
var bulletPierce := 1

func attack():
	if is_instance_valid(current_target):
		var projectileScene := preload("res://Scenes/turrets/projectileTurret/bullet/bulletBase.tscn")
		var projectile := projectileScene.instantiate()
		projectile.bullet_type = Data.turrets[turret_type]["bullet"]
		projectile.damage = damage
		projectile.speed = bulletSpeed
		projectile.pierce = bulletPierce
		Globals.projectilesNode.add_child(projectile)
<<<<<<< HEAD
		projectile.position = position
		projectile.target = current_target.position
=======
		projectile.position = get_muzzle_position()
		projectile.target = current_target.global_position
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd
	else:
		try_get_closest_target()
