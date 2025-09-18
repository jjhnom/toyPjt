extends Node
@onready var data = $"../DataHub"
func use_arrow_rain() -> void:
    var conf = data.skills.get("arrow_rain", {})
    var dmg:int = conf.get("damage", 120)
    var map = $"../../Map"
    for e in map.get_node("EnemyLayer").get_children():
        if e.has_method("take_damage"): e.take_damage(int(dmg/3.0))
func use_global_slow() -> void:
    var conf = data.skills.get("global_slow", {})
    var dur:float = conf.get("duration", 5.0)
    var fac:float = conf.get("factor", 0.6)
    var map = $"../../Map"
    for e in map.get_node("EnemyLayer").get_children():
        if e.has_method("apply_slow"): e.apply_slow(fac, dur)
func use_heal_gate() -> void:
    var conf = data.skills.get("heal_gate", {})
    var amt:int = conf.get("heal", 20)
    $"..".damage_life(-amt)
