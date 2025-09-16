extends Node

const turrets := {
	"archer": {
		"stats": {
			"damage": 15.0,
			"attack_speed": 1.5,
			"attack_range": 300.0,
			"bulletSpeed": 300.0,
			"bulletPierce": 1,
		},
		"upgrades": {
			"damage": {"amount": 5.0, "multiplies": false},
			"attack_speed": {"amount": 1.3, "multiplies": true},
			"attack_range": {"amount": 50.0, "multiplies": false},
		},
		"name": "Archer Tower",
		"cost": 60,
		"upgrade_cost": 40,
		"max_level": 3,
		"scene": "res://Scenes/turrets/archerTurret/archerTurret.tscn",
		"sprite": "res://Assets/turrets/spriteframes_96x96.tres",
		"scale": 1.0,
		"rotates": true,
		"bullet": "arrow",
		"animation": "archer_idle",
		"attack_animation": "archer_attack",
	},
	"wizard": {
		"stats": {
			"damage": 8.0,
			"attack_speed": 1.0,
			"attack_range": 250.0,
			"bulletSpeed": 200.0,
			"bulletPierce": 3,
		},
		"upgrades": {
			"damage": {"amount": 3.0, "multiplies": false},
			"attack_speed": {"amount": 1.2, "multiplies": true},
			"bulletPierce": {"amount": 1, "multiplies": false},
		},
		"name": "Wizard Tower",
		"cost": 70,
		"upgrade_cost": 60,
		"max_level": 3,
		"scene": "res://Scenes/turrets/wizardTurret/wizardTurret.tscn",
		"sprite": "res://Assets/turrets/spriteframes_96x96.tres",
		"scale": 1.0,
		"rotates": true,
		"bullet": "magic",
		"animation": "wizard_ice_idle",
		"attack_animation": "wizard_ice_attack",
	},
	"warrior": {
		"stats": {
			"damage": 25.0,
			"attack_speed": 0.8,
			"attack_range": 120.0,
		},
		"upgrades": {
			"damage": {"amount": 8.0, "multiplies": false},
			"attack_speed": {"amount": 1.4, "multiplies": true},
			"attack_range": {"amount": 20.0, "multiplies": false},
		},
		"name": "Warrior Tower",
		"cost": 50,
		"upgrade_cost": 70,
		"max_level": 3,
		"scene": "res://Scenes/turrets/warriorTurret/warriorTurret.tscn",
		"sprite": "res://Assets/turrets/spriteframes_96x96.tres",
		"scale": 1.0,
		"rotates": false,
		"animation": "warrior_idle",
		"attack_animation": "warrior_attack",
	},
}

const stats := {
	"damage": {"name": "Damage"},
	"attack_speed": {"name": "Speed"},
	"attack_range": {"name": "Range"},
	"bulletSpeed": {"name": "Bullet Speed"},
	"bulletPierce": {"name": "Bullet Pierce"},
}

const bullets := {
	"arrow": {
		"frames": "res://Assets/bullets/bullet1.tres",
	},
	"magic": {
		"frames": "res://Assets/bullets/bullet2.tres",
	}
}

const enemies := {
	"redDino": {
		"stats": {
			"hp": 10.0,
			"speed": 1.0,
			"baseDamage": 5.0,
			"goldYield": 10.0,
			},
		"difficulty": 1.0,
		"sprite": "res://Assets/enemies/dino1.png",
	},
	"blueDino": {
		"stats": {
			"hp": 5.0,
			"speed": 2.0,
			"baseDamage": 5.0,
			"goldYield": 10.0,
			},
		"difficulty": 2.0,
		"sprite": "res://Assets/enemies/dino2.png",
	},
	"yellowDino": {
		"stats": {
			"hp": 10.0,
			"speed": 5.0,
			"baseDamage": 1.0,
			"goldYield": 10.0,
			},
		"difficulty": 3.0,
		"sprite": "res://Assets/enemies/dino3.png",
	},
	"greenDino": {
		"stats": {
			"hp": 10.0,
			"speed": 10.0,
			"baseDamage": 1.0,
			"goldYield": 10.0,
			},
		"difficulty": 4.0,
		"sprite": "res://Assets/enemies/dino4.png",
	}
}

const maps := {
	"map0": {
		"name": "Castle Map",
		"bg": "res://Assets/maps/map0.png",
		"scene": "res://Scenes/maps/map0.tscn",
		"baseHp": 20,
		"startingGold": 150,
		"spawner_settings":
			{
			"difficulty": {"initial": 1.5, "increase": 1.3, "multiplies": true},
			"max_waves": 12,
			"wave_spawn_count": 12,
			"special_waves": {},
			},
	},
	"map1": {
		"name": "Grass Map",
		"bg": "res://Assets/maps/map1.webp",
		"scene": "res://Scenes/maps/map1.tscn",
		"baseHp": 10,
		"startingGold": 100,
		"spawner_settings":
			{
			"difficulty": {"initial": 2.0, "increase": 1.5, "multiplies": true},
			"max_waves": 10,
			"wave_spawn_count": 10,
			"special_waves": {},
			},
	},
	"map2": {
		"name": "Desert Map",
		"bg": "res://Assets/maps/map2.png",
		"scene": "res://Scenes/maps/map2.tscn",
		"baseHp": 15,
		"startingGold": 200,
		"spawner_settings":
			{
			"difficulty": {"initial": 1.0, "increase": 1.2, "multiplies": true},
			"max_waves": 10,
			"wave_spawn_count": 10,
			"special_waves": {},
			},
	}
}
