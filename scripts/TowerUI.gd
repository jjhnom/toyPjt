extends CanvasLayer

@onready var tower_manager = get_tree().current_scene.get_node("TowerManager")

func _ready():
	# 타워 건설 버튼들 생성
	create_tower_buttons()

func create_tower_buttons():
	# 기본 타워 버튼
	var basic_button = create_button("기본 타워 (50골드)", Vector2(20, 200))
	basic_button.pressed.connect(_on_basic_tower_pressed)
	
	# 빠른 타워 버튼
	var rapid_button = create_button("빠른 타워 (75골드)", Vector2(20, 250))
	rapid_button.pressed.connect(_on_rapid_tower_pressed)
	
	# 강력한 타워 버튼
	var heavy_button = create_button("강력한 타워 (100골드)", Vector2(20, 300))
	heavy_button.pressed.connect(_on_heavy_tower_pressed)

func create_button(text, pos):
	var button = Button.new()
	button.text = text
	button.position = pos
	button.size = Vector2(200, 40)
	add_child(button)
	return button

func _on_basic_tower_pressed():
	if tower_manager:
		tower_manager.set_tower_type("basic")

func _on_rapid_tower_pressed():
	if tower_manager:
		tower_manager.set_tower_type("rapid")

func _on_heavy_tower_pressed():
	if tower_manager:
		tower_manager.set_tower_type("heavy")
