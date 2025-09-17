extends Node
class_name DataHub

var towers: Dictionary = {}
var enemies: Dictionary = {}
var waves: Dictionary = {}
var skills: Dictionary = {}

func _ready() -> void:
    towers  = _load_json("res://data/towers.json")
    enemies = _load_json("res://data/enemies.json")
    waves   = _load_json("res://data/waves.json")
    skills  = _load_json("res://data/skills.json")

func _load_json(path: String) -> Dictionary:
    var f := FileAccess.open(path, FileAccess.READ)
    if f:
        var data = JSON.parse_string(f.get_as_text())
        if typeof(data) == TYPE_DICTIONARY:
            return data
    push_warning("JSON load failed: %s" % path)
    return {}