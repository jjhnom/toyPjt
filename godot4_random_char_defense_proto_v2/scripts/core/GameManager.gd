extends Node
signal gold_changed(v:int)
signal life_changed(v:int)
signal wave_changed(i:int)
signal game_over(win:bool)
@export var initial_gold:int = 2000
@export var initial_life:int = 20
var gold:int
var life:int
@onready var ui:Node = $"../UI"
@onready var wave_manager:Node = $WaveManager
func _ready() -> void:
	# 초기값 설정
	gold = initial_gold
	life = initial_life
	
	
	# 다음 프레임에서 UI 초기화 (타이밍 문제 해결)
	call_deferred("_initialize_ui")

func _initialize_ui() -> void:
	
	# UI 바인딩
	if ui and ui.has_method("bind"):
		ui.bind(self)
	
	# 웨이브 매니저 연결
	if wave_manager:
		wave_manager.connect("wave_cleared", Callable(self, "_on_wave_cleared"))
	
	# 초기 UI 업데이트 신호 발생 (한번 더)
	call_deferred("_update_initial_ui")
	
	# 잠시 대기 후 첫 웨이브 시작
	await get_tree().create_timer(0.8).timeout
	if wave_manager:
		wave_manager.start_next_wave()

func _update_initial_ui() -> void:
	emit_signal("gold_changed", gold)
	emit_signal("life_changed", life)
	emit_signal("wave_changed", 1)  # 첫 번째 웨이브 표시
func add_gold(v:int) -> void:
	gold += v; emit_signal("gold_changed", gold)
func spend_gold(v:int) -> bool:
	if gold < v: return false
	gold -= v; emit_signal("gold_changed", gold); return true
func damage_life(v:int) -> void:
	life -= v; emit_signal("life_changed", life)
	if life <= 0: emit_signal("game_over", false)
func _on_wave_cleared(idx:int) -> void:
	emit_signal("wave_changed", idx + 1)  # 다음 웨이브 번호 표시
	await get_tree().create_timer(1.2).timeout
	if wave_manager:
		wave_manager.start_next_wave()
