package com.ehv.api.presentation;

import java.util.ArrayList;
import java.util.List;

import com.ehv.api.view.BoardStateView;
import com.ehv.api.view.CellViewState;
import com.ehv.api.view.DuelPhase;
import com.ehv.api.view.GameStateResponse;
import com.ehv.battleship.legacy.controller.GameController;
import com.ehv.battleship.model.CellStatus;
import com.ehv.battleship.model.Coordinate;
import com.ehv.battleship.model.GameState;
import com.ehv.battleship.model.Player;

/**
 * Projette l'état du jeu (couche modèle + état session du contrôleur) en {@link GameStateResponse}
 * destiné au frontend.
 *
 * <p>Cette classe est la <b>seule</b> à connaître :
 * <ul>
 *   <li>les identifiants de planche {@code A1}/{@code B1}/{@code C1}/{@code D1} ;</li>
 *   <li>la règle de brouillard (les bateaux adverses sont masqués hors {@link DuelPhase#GAME_OVER}) ;</li>
 *   <li>la conversion {@link GameState} → {@link DuelPhase} attendue par l'API.</li>
 * </ul>
 *
 * <p>Aucune règle métier n'est dupliquée ici : tout passe par le {@link GameController}.
 */
public final class ApiGameStatePresenter {

    private ApiGameStatePresenter() {}

    public static GameStateResponse project(GameController controller, int viewerPlayer) {
        validateViewer(controller, viewerPlayer);
        DuelPhase phase = mapPhase(controller.getGameState());
        int boardSize = controller.getBoardSize();
        int playerCount = controller.getPlayerCount();

        List<BoardStateView> boards = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            Player player = controller.getPlayerByNumber(p);
            boolean ownBoard = (p == viewerPlayer);
            boards.add(buildBoard(player, ownBoard, boardSize, phase, boardIdForPlayer(p)));
        }

        return new GameStateResponse(
            boardSize,
            phase,
            controller.getCurrentPlayerNumber(),
            controller.getCurrentTargetPlayer(),
            controller.getWinnerNumber(),
            List.copyOf(boards),
            computePlayersAlive(controller, playerCount),
            computeAiPlayers(controller, playerCount),
            computePlacementLocked(controller, playerCount),
            computePlacedShipTypesByPlayer(controller, viewerPlayer, playerCount)
        );
    }

    public static DuelPhase mapPhase(GameState state) {
        if (state == null) return DuelPhase.PLACEMENT;
        return switch (state) {
            case SETUP, PLACEMENT -> DuelPhase.PLACEMENT;
            case PLAYING -> DuelPhase.BATTLE;
            case FINISHED -> DuelPhase.GAME_OVER;
        };
    }

    public static String boardIdForPlayer(int playerNumber) {
        return switch (playerNumber) {
            case 1 -> "A1";
            case 2 -> "B1";
            case 3 -> "C1";
            case 4 -> "D1";
            default -> throw new IllegalArgumentException(
                "Joueur non supporté pour l'affichage : " + playerNumber);
        };
    }

    private static void validateViewer(GameController controller, int viewerPlayer) {
        int playerCount = controller.getPlayerCount();
        if (viewerPlayer < 1 || viewerPlayer > playerCount) {
            throw new IllegalArgumentException("Le joueur doit être entre 1 et " + playerCount);
        }
    }

    private static BoardStateView buildBoard(Player player, boolean ownBoard, int boardSize,
                                              DuelPhase phase, String boardId) {
        List<List<CellViewState>> cells = new ArrayList<>(boardSize);
        for (int y = 0; y < boardSize; y++) {
            List<CellViewState> row = new ArrayList<>(boardSize);
            for (int x = 0; x < boardSize; x++) {
                row.add(projectCell(player, ownBoard, x, y, phase));
            }
            cells.add(List.copyOf(row));
        }
        return new BoardStateView(boardId, ownBoard, List.copyOf(cells));
    }

    private static CellViewState projectCell(Player player, boolean ownBoard, int x, int y,
                                              DuelPhase phase) {
        CellStatus status = player.getGrid().getCell(new Coordinate(x, y));
        return switch (status) {
            case EMPTY -> CellViewState.EMPTY;
            case MISS  -> CellViewState.MISS;
            case HIT   -> CellViewState.HIT;
            case SUNK  -> CellViewState.SUNK;
            case SHIP  -> (ownBoard || phase == DuelPhase.GAME_OVER)
                            ? CellViewState.SHIP
                            : CellViewState.EMPTY;
        };
    }

    private static List<Boolean> computePlayersAlive(GameController controller, int playerCount) {
        List<Boolean> alive = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            alive.add(!controller.getPlayerByNumber(p).hasLost());
        }
        return List.copyOf(alive);
    }

    private static List<Boolean> computeAiPlayers(GameController controller, int playerCount) {
        List<Boolean> ais = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            ais.add(controller.getPlayerByNumber(p).isAI());
        }
        return List.copyOf(ais);
    }

    private static List<Boolean> computePlacementLocked(GameController controller, int playerCount) {
        List<Boolean> locked = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            locked.add(controller.isPlacementLocked(p));
        }
        return List.copyOf(locked);
    }

    private static List<List<String>> computePlacedShipTypesByPlayer(GameController controller,
                                                                      int viewerPlayer,
                                                                      int playerCount) {
        List<List<String>> result = new ArrayList<>(playerCount);
        for (int p = 1; p <= playerCount; p++) {
            if (p != viewerPlayer) {
                result.add(List.of());
                continue;
            }
            List<String> types = new ArrayList<>(controller.getPlacedShipTypes(p));
            types.sort(String::compareTo);
            result.add(List.copyOf(types));
        }
        return List.copyOf(result);
    }
}
