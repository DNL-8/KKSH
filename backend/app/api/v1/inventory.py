from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.deps import db_session, get_current_user
from app.models import User
from app.schemas import InventoryItemOut, UseInventoryItemIn, UseInventoryItemOut, VitalsOut
from app.services.inventory import list_inventory, use_inventory_item

router = APIRouter()


@router.get("/inventory", response_model=list[InventoryItemOut])
def inventory_list(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    return [InventoryItemOut(**row) for row in list_inventory(session, user)]


@router.post("/inventory/use", response_model=UseInventoryItemOut)
def inventory_use(
    payload: UseInventoryItemIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    result = use_inventory_item(session, user, item_id=payload.itemId, qty=int(payload.qty))
    return UseInventoryItemOut(
        item=InventoryItemOut(**result["item"]),
        consumedQty=int(result["consumedQty"]),
        vitals=VitalsOut(**result["vitals"]) if result.get("vitals") else None,
    )
