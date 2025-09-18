extends Node
var characters := {}
var enemies := {}
var waves := {}
var skills := {}
func _ready() -> void:
    characters = _load_json("res://data/characters.json")
    enemies = _load_json("res://data/enemies.json")
    waves = _load_json("res://data/waves.json")
    skills = _load_json("res://data/skills.json")
func _load_json(path:String) -> Dictionary:
    var f := FileAccess.open(path, FileAccess.READ)
    if f == null: return {}
    var data = JSON.parse_string(f.get_as_text())
    return data if typeof(data) == TYPE_DICTIONARY else {}
