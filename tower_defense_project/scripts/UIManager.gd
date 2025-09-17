extends CanvasLayer
class_name UIManager

@onready var gm: GameManager = $"../GameManager"
@onready var wm: WaveManager = $"../WaveManager"
@onready var sm: SkillManager = $"../SkillManager"
@onready var pc: PlacementController = $"../PlacementController"

# UI 노드들
@onready var gold_label: Label = $HUD/TopPanel/StatusContainer/LeftStatus/GoldLabel
@onready var life_label: Label = $HUD/TopPanel/StatusContainer/LeftStatus/LifeLabel
@onready var mana_label: Label = $HUD/TopPanel/StatusContainer/RightStatus/ManaLabel
@onready var wave_label: Label = $HUD/TopPanel/StatusContainer/RightStatus/WaveLabel

# 타워 버튼들
@onready var archer_button: Button = $HUD/BottomPanel/ShopPanel/TowerSection/TowerButtons/ArcherButton
@onready var barracks_button: Button = $HUD/BottomPanel/ShopPanel/TowerSection/TowerButtons/BarracksButton
@onready var mage_button: Button = $HUD/BottomPanel/ShopPanel/TowerSection/TowerButtons/MageButton
@onready var cannon_button: Button = $HUD/BottomPanel/ShopPanel/TowerSection/TowerButtons/CannonButton

# 스킬 버튼들
@onready var arrow_rain_button: Button = $HUD/BottomPanel/ShopPanel/SkillSection/SkillPanel/ArrowRainButton
@onready var knight_charge_button: Button = $HUD/BottomPanel/ShopPanel/SkillSection/SkillPanel/KnightChargeButton
@onready var heal_gate_button: Button = $HUD/BottomPanel/ShopPanel/SkillSection/SkillPanel/HealGateButton

# 게임 컨트롤 버튼들
@onready var pause_button: Button = $HUD/GameControls/PauseButton
@onready var speed_button: Button = $HUD/GameControls/SpeedButton
@onready var start_wave_button: Button = $HUD/GameControls/StartWaveButton

var current_wave: int = 0
var game_speed: float = 1.0
var is_paused: bool = false

func _ready() -> void:
	# GameManager 시그널 연결
	gm.gold_changed.connect(_on_gold_changed)
	gm.life_changed.connect(_on_life_changed)
	gm.mana_changed.connect(_on_mana_changed)
	gm.game_over.connect(_on_game_over)
	
	# WaveManager 시그널 연결
	wm.wave_started.connect(_on_wave_started)
	wm.wave_cleared.connect(_on_wave_cleared)
	
	# SkillManager 시그널 연결
	sm.skill_cooldown_updated.connect(_on_skill_cooldown_updated)
	
	# 버튼 시그널 연결
	_connect_tower_buttons()
	_connect_skill_buttons()
	_connect_control_buttons()
	
	# 초기 UI 업데이트
	_update_all_ui()

func _connect_tower_buttons() -> void:
	archer_button.pressed.connect(func(): _on_tower_button_pressed("archer"))
	barracks_button.pressed.connect(func(): _on_tower_button_pressed("barracks"))
	mage_button.pressed.connect(func(): _on_tower_button_pressed("mage"))
	cannon_button.pressed.connect(func(): _on_tower_button_pressed("cannon"))

func _connect_skill_buttons() -> void:
	arrow_rain_button.pressed.connect(func(): _on_skill_button_pressed("arrow_rain"))
	knight_charge_button.pressed.connect(func(): _on_skill_button_pressed("knight_charge"))
	heal_gate_button.pressed.connect(func(): _on_skill_button_pressed("heal_gate"))

func _connect_control_buttons() -> void:
	pause_button.pressed.connect(_on_pause_button_pressed)
	speed_button.pressed.connect(_on_speed_button_pressed)
	start_wave_button.pressed.connect(_on_start_wave_button_pressed)

func _on_tower_button_pressed(tower_id: String) -> void:
	pc.start_drag(tower_id)

func _on_skill_button_pressed(skill_id: String) -> void:
	# 화면 중앙에 스킬 사용 (실제로는 터치 위치 사용)
	var screen_center = get_viewport().get_visible_rect().size / 2
	sm.use_skill(skill_id, screen_center)

func _on_pause_button_pressed() -> void:
	is_paused = !is_paused
	get_tree().paused = is_paused
	pause_button.text = "Resume" if is_paused else "Pause"

func _on_speed_button_pressed() -> void:
	if game_speed == 1.0:
		game_speed = 2.0
		speed_button.text = "Speed x2"
	else:
		game_speed = 1.0
		speed_button.text = "Speed x1"
	
	Engine.time_scale = game_speed

func _on_start_wave_button_pressed() -> void:
	wm.start_next_wave()

func _on_gold_changed(value: int) -> void:
	gold_label.text = "Gold: " + str(value)
	_update_tower_button_states()

func _on_life_changed(value: int) -> void:
	life_label.text = "Life: " + str(value)

func _on_mana_changed(value: int) -> void:
	mana_label.text = "Mana: " + str(value)
	_update_skill_button_states()

func _on_wave_started(wave_number: int) -> void:
	current_wave = wave_number
	wave_label.text = "Wave: " + str(wave_number)
	start_wave_button.disabled = true

func _on_wave_cleared(_wave_number: int) -> void:
	start_wave_button.disabled = false

func _on_skill_cooldown_updated(_skill_id: String, _remaining: float) -> void:
	_update_skill_button_states()

func _on_game_over(victory: bool) -> void:
	# 게임 오버 UI 표시 (간단한 구현)
	var message = "Victory!" if victory else "Defeat!"
	print(message)

func _update_all_ui() -> void:
	_update_tower_button_states()
	_update_skill_button_states()

func _update_tower_button_states() -> void:
	var tower_buttons: Dictionary = {
		"archer": archer_button,
		"barracks": barracks_button,
		"mage": mage_button,
		"cannon": cannon_button
	}
	
	for tower_id in tower_buttons.keys():
		var button: Button = tower_buttons[tower_id]
		var data_hub: DataHub = gm.get_node("../DataHub")
		var tower_data: Dictionary = data_hub.towers.get(tower_id, {})
		var price: int = tower_data.get("price", 0)
		
		button.disabled = gm.gold < price

func _update_skill_button_states() -> void:
	var skill_buttons: Dictionary = {
		"arrow_rain": arrow_rain_button,
		"knight_charge": knight_charge_button,
		"heal_gate": heal_gate_button
	}
	
	for skill_id in skill_buttons.keys():
		var button: Button = skill_buttons[skill_id]
		var can_use: bool = sm.can_use_skill(skill_id)
		button.disabled = not can_use
		
		# 쿨다운 표시
		var cooldown: float = sm.skill_cooldowns.get(skill_id, 0.0)
		if cooldown > 0:
			button.text = skill_id.capitalize() + "\n" + str(int(cooldown)) + "s"
		else:
			var data_hub: DataHub = gm.get_node("../DataHub")
			var skill_data: Dictionary = data_hub.skills.get(skill_id, {})
			var cost: int = skill_data.get("cost", 0)
			button.text = skill_id.capitalize() + "\n" + str(cost) + " Mana"
