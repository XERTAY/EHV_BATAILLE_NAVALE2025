package com.ehv.api.view;

import java.util.List;

public record BoardStateView(
    String boardId,
    boolean ownBoard,
    List<List<CellViewState>> cells
) {
}
