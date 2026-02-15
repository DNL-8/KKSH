from __future__ import annotations

from datetime import datetime, timezone
from typing import TypedDict

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import User, UserInventory
from app.services.progression import apply_vitals, get_or_create_user_stats


class InventoryDef(TypedDict):
    name: str
    desc: str
    consumable: bool
    default_qty: int


INVENTORY_CATALOG: dict[str, InventoryDef] = {
    "coffee": {
        "name": "Cafe Preto Infinito",
        "desc": "Restaura 20 HP e reduz fadiga",
        "consumable": True,
        "default_qty": 5,
    },
    "keyboard": {
        "name": "Teclado Enferrujado",
        "desc": "Item inicial",
        "consumable": False,
        "default_qty": 1,
    },
    "debug_eye": {
        "name": "Olho do Debugador",
        "desc": "Passiva",
        "consumable": False,
        "default_qty": 0,
    },
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_dict(row: UserInventory, meta: InventoryDef) -> dict:
    return {
        "id": row.item_id,
        "name": meta["name"],
        "desc": meta["desc"],
        "qty": int(row.qty),
        "consumable": bool(meta["consumable"]),
    }


def _vitals_dict(user_stats) -> dict:
    return {
        "hp": int(user_stats.hp),
        "maxHp": int(user_stats.max_hp),
        "mana": int(user_stats.mana),
        "maxMana": int(user_stats.max_mana),
        "fatigue": int(user_stats.fatigue),
        "maxFatigue": int(user_stats.max_fatigue),
    }


def ensure_user_inventory(session: Session, user: User) -> list[UserInventory]:
    rows = session.exec(select(UserInventory).where(UserInventory.user_id == user.id)).all()
    by_id = {r.item_id: r for r in rows}
    changed = False

    for item_id, meta in INVENTORY_CATALOG.items():
        if item_id in by_id:
            continue
        row = UserInventory(
            user_id=user.id,
            item_id=item_id,
            qty=int(meta["default_qty"]),
            updated_at=_utcnow(),
        )
        session.add(row)
        rows.append(row)
        by_id[item_id] = row
        changed = True

    if changed:
        session.commit()
        rows = session.exec(select(UserInventory).where(UserInventory.user_id == user.id)).all()

    return rows


def list_inventory(session: Session, user: User, *, ensure_defaults: bool = True) -> list[dict]:
    rows = (
        ensure_user_inventory(session, user)
        if ensure_defaults
        else session.exec(select(UserInventory).where(UserInventory.user_id == user.id)).all()
    )
    by_id = {r.item_id: r for r in rows}
    out: list[dict] = []

    for item_id, meta in INVENTORY_CATALOG.items():
        row = by_id.get(item_id)
        if not row:
            out.append(
                {
                    "id": item_id,
                    "name": meta["name"],
                    "desc": meta["desc"],
                    "qty": int(meta["default_qty"]),
                    "consumable": bool(meta["consumable"]),
                }
            )
            continue
        out.append(_row_to_dict(row, meta))

    return out


def use_inventory_item(session: Session, user: User, item_id: str, qty: int = 1) -> dict:
    if qty < 1 or qty > 99:
        raise HTTPException(status_code=422, detail="qty must be between 1 and 99")

    meta = INVENTORY_CATALOG.get(item_id)
    if not meta:
        raise HTTPException(status_code=404, detail="unknown item")

    rows = ensure_user_inventory(session, user)
    by_id = {r.item_id: r for r in rows}
    row = by_id.get(item_id)
    if not row:
        raise HTTPException(status_code=404, detail="item not found for user")

    consumed_qty = 0
    stats = get_or_create_user_stats(session, user)
    if meta["consumable"]:
        if int(row.qty) < qty:
            raise HTTPException(status_code=400, detail="insufficient quantity")
        row.qty = int(row.qty) - int(qty)
        row.updated_at = _utcnow()
        session.add(row)
        session.commit()
        session.refresh(row)
        consumed_qty = qty

        # Item effects (persistent):
        # - coffee: +20 HP and -20 fatigue per consumed unit
        if item_id == "coffee" and consumed_qty > 0:
            stats = apply_vitals(
                session,
                user,
                hp_delta=20 * consumed_qty,
                fatigue_delta=-20 * consumed_qty,
            )

    return {
        "item": _row_to_dict(row, meta),
        "consumedQty": consumed_qty,
        "vitals": _vitals_dict(stats),
    }
