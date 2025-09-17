extends Node
class_name GameManager

signal gold_changed(val: int)
signal life_changed(val: int)
signal mana_changed(val: int)
signal game_over(victory: bool)

@export var start_gold: int = 100
@export var start_mana: int = 50
@export var life: int = 20
@export var max_mana: int = 100
@export var mana_regen: float = 2.0  # 마나 초당 회복량

var gold: int
var mana: int

func _ready() -> void:
    gold = start_gold
    mana = start_mana
    emit_signal("gold_changed", gold)
    emit_signal("life_changed", life)
    emit_signal("mana_changed", mana)

func add_gold(amount: int) -> void:
    gold += amount
    emit_signal("gold_changed", gold)

func spend_gold(amount: int) -> bool:
    print("GameManager.spend_gold called: amount=", amount, " current_gold=", gold)
    if gold >= amount:
        gold -= amount
        print("Gold spent successfully: new_gold=", gold)
        emit_signal("gold_changed", gold)
        return true
    else:
        print("Insufficient gold: need=", amount, " have=", gold)
        return false

func add_mana(amount: int) -> void:
    mana = min(mana + amount, max_mana)
    emit_signal("mana_changed", mana)

func spend_mana(amount: int) -> bool:
    if mana >= amount:
        mana -= amount
        emit_signal("mana_changed", mana)
        return true
    return false

func damage_life(amount: int) -> void:
    life -= amount
    emit_signal("life_changed", life)
    if life <= 0:
        emit_signal("game_over", false)

func heal_life(amount: int) -> void:
    life += amount
    emit_signal("life_changed", life)

func win() -> void:
    emit_signal("game_over", true)

func _process(delta: float) -> void:
    # 마나 자동 회복
    if mana < max_mana:
        var regen_amount = mana_regen * delta
        if regen_amount >= 1.0:
            add_mana(int(regen_amount))