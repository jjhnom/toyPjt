extends CharacterBody2D

var speed = 100
var max_hp = 100
var current_hp = 100
var hp_scale = 1.0
var gold_reward = 5

# 죽음 신호
signal enemy_died

func _ready():
	# HP 스케일 적용
	current_hp = max_hp * hp_scale
	max_hp = current_hp
	
	# enemy 그룹에 추가 (투사체 충돌 감지용)
	add_to_group("enemy")

func _physics_process(_delta): 
	velocity = Vector2.LEFT * speed
	move_and_slide()
	
	# 화면 왼쪽 끝에 도달하면 베이스에 데미지
	if position.x < -50:
		damage_base()
		queue_free()

func set_hp_scale(scale_value):
	hp_scale = scale_value
	current_hp = max_hp * hp_scale
	max_hp = current_hp

func take_damage(damage):
	print("적이 데미지 받음: ", damage, " 현재 HP: ", current_hp)
	current_hp -= damage
	print("데미지 후 HP: ", current_hp)
	if current_hp <= 0:
		die()

func die():
	print("적이 죽음!")
	
	# 직접 Main 노드에 알림
	var main = get_tree().current_scene
	if main and main.has_method("on_enemy_killed"):
		print("Main 노드에 직접 적 처치 알림")
		main.on_enemy_killed(5)  # 5골드 보상
	else:
		print("Main 노드를 찾을 수 없거나 on_enemy_killed 메서드가 없습니다!")
	
	# 죽음 신호도 발생 (기존 방식) - 인수 없이 발생
	print("죽음 신호 발생 시도...")
	enemy_died.emit()
	print("죽음 신호 발생 완료")
	print("적 처치: HP 0")
	queue_free()

func damage_base():
	# Main 노드에 베이스 데미지 알림
	var main = get_tree().current_scene
	if main and main.has_method("on_enemy_reach_base"):
		main.on_enemy_reach_base(1)

func connect_death_signal(target, method_name):
	print("Enemy: 죽음 신호 연결 시도 - 대상: ", target, " 메서드: ", method_name)
	enemy_died.connect(Callable(target, method_name))
	print("Enemy: 죽음 신호 연결 완료")
