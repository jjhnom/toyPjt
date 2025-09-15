extends CanvasLayer
@onready var wave_label=$WaveLabel
@onready var gold_label=$GoldLabel
@onready var base_label=$BaseLabel
@onready var player_stats_label=$PlayerStatsLabel

# 게임 상태 변수들
var current_gold = 100  # 초기 골드
var base_hp = 100       # 초기 베이스 HP
var current_wave = 0

func _ready():
	# 초기 UI 업데이트
	update_gold_display()
	update_base_hp_display()

func set_wave(w): 
	current_wave = w
	wave_label.text = 'WAVE %d' % w

# 골드 추가/차감 함수
func update_gold(amount):
	current_gold += amount
	update_gold_display()

# 골드 표시 업데이트
func update_gold_display():
	gold_label.text = 'GOLD %d' % current_gold

# 베이스 HP 변경 함수 (양수면 회복, 음수면 데미지)
func update_base_hp(amount):
	base_hp += amount
	if base_hp < 0:
		base_hp = 0
	elif base_hp > 100:
		base_hp = 100
	update_base_hp_display()

# 베이스 HP 표시 업데이트
func update_base_hp_display():
	base_label.text = 'BASE %d' % base_hp

# 골드 확인 함수 (업그레이드 등에서 사용)
func get_gold():
	return current_gold

# 골드 소모 함수 (업그레이드 등에서 사용)
func spend_gold(amount):
	if current_gold >= amount:
		current_gold -= amount
		update_gold_display()
		return true
	return false

# 게임 오버 체크
func is_game_over():
	return base_hp <= 0

# 플레이어 스탯 업데이트
func update_player_stats(damage, cooldown, range_value):
	player_stats_label.text = "플레이어 스탯:\n공격력: %d\n공격속도: %.1f초\n사거리: %d" % [damage, cooldown, range_value]
