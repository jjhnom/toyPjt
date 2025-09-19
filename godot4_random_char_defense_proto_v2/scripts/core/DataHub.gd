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

# 캐릭터 데이터를 가져오는 함수
func get_character_data(character_id: String) -> Dictionary:
    if characters.has(character_id):
        return characters[character_id]
    return {}

# 적 데이터를 가져오는 함수
func get_enemy_data(enemy_id: String) -> Dictionary:
    if enemies.has(enemy_id):
        return enemies[enemy_id]
    return {}

# 웨이브 데이터를 가져오는 함수
func get_wave_data(wave_id: String) -> Dictionary:
    if waves.has(wave_id):
        return waves[wave_id]
    return {}

# 스킬 데이터를 가져오는 함수
func get_skill_data(skill_id: String) -> Dictionary:
    if skills.has(skill_id):
        return skills[skill_id]
    return {}
