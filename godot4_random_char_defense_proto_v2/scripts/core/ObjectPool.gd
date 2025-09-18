extends Node
var pools := {}
func pop(key:String, factory:Callable) -> Node:
    if pools.has(key) and pools[key].size() > 0:
        var n = pools[key].pop_back()
        # 풀에서 가져온 노드는 ObjectPool의 자식이므로 제거
        if n.get_parent() == self:
            remove_child(n)
        n.show()
        if n.has_method("on_pool_activate"): n.on_pool_activate()
        return n
    var inst = factory.call()
    if inst.has_method("on_pool_activate"): inst.on_pool_activate()
    return inst
func push(key:String, n:Node) -> void:
    if not pools.has(key): pools[key] = []
    if n.get_parent(): n.get_parent().remove_child(n)
    add_child(n); n.hide()
    if n.has_method("on_pool_deactivate"): n.on_pool_deactivate()
    pools[key].append(n)
