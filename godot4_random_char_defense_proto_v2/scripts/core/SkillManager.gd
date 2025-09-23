extends Node
@onready var data = $"../DataHub"

var last_skill_time: float = 0.0

func use_global_slow() -> void:
    var conf = data.skills.get("global_slow", {})
    var cost: int = conf.get("cost", 35)
    var cooldown: float = conf.get("cooldown", 25.0)
    var dur: float = conf.get("duration", 5.0)
    var fac: float = conf.get("factor", 0.6)
    
    # 쿨다운 체크
    var current_time = Time.get_ticks_msec() / 1000.0
    if current_time - last_skill_time < cooldown:
        print("슬로우 스킬 쿨다운 중: %.1f초 남음" % (cooldown - (current_time - last_skill_time)))
        return
    
    # 골드 체크
    var gm = $".."
    if not gm.spend_gold(cost):
        print("슬로우 스킬 사용 실패: 골드 부족 (필요: %d)" % cost)
        return
    
    # 스킬 사용
    last_skill_time = current_time
    
    # 방법 1: EnemyLayer에서 적들 찾기
    var map = $"../../Map"
    var enemies = []
    
    var enemy_layer = map.get_node("EnemyLayer")
    if enemy_layer:
        enemies = enemy_layer.get_children()
    
    # 방법 2: enemy 그룹에서 적들 찾기 (백업)
    var enemy_group = get_tree().get_nodes_in_group("enemy")
    
    # 두 방법 모두 사용하여 중복 제거
    var all_enemies = []
    for enemy in enemies:
        if enemy and is_instance_valid(enemy) and enemy not in all_enemies:
            all_enemies.append(enemy)
    
    for enemy in enemy_group:
        if enemy and is_instance_valid(enemy) and enemy not in all_enemies:
            all_enemies.append(enemy)
    
    
    var affected_count = 0
    
    for e in all_enemies:
        if e.has_method("apply_slow"):
            e.apply_slow(fac, dur)
            affected_count += 1
    
