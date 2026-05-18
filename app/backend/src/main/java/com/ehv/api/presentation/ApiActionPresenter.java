package com.ehv.api.presentation;

import com.ehv.api.view.ActionResponse;
import com.ehv.api.view.ActionResult;
import com.ehv.api.view.GameStateResponse;
import com.ehv.battleship.legacy.controller.GameController;
import com.ehv.battleship.legacy.controller.GameController.ShotOutcome;
import com.ehv.battleship.model.ShotResult;

/**
 * Construit les {@link ActionResponse} renvoyés par les endpoints HTTP.
 *
 * <p>C'est la seule classe qui connaît les libellés utilisateur (français) et la conversion
 * {@link ShotResult} → {@link ActionResult}.
 */
public final class ApiActionPresenter {

    private ApiActionPresenter() {}

    public static ActionResponse placed(GameController controller, int viewerPlayer) {
        return build(ActionResult.PLACED, controller, viewerPlayer, null);
    }

    public static ActionResponse removed(GameController controller, int viewerPlayer) {
        return build(ActionResult.REMOVED, controller, viewerPlayer, null);
    }

    public static ActionResponse confirmed(GameController controller, int viewerPlayer) {
        return build(ActionResult.CONFIRMED, controller, viewerPlayer, null);
    }

    public static ActionResponse shot(GameController controller, int viewerPlayer, ShotOutcome outcome) {
        return build(actionResultFromShot(outcome.result()), controller, viewerPlayer, outcome);
    }

    public static ActionResponse aiSkipped(GameController controller, int viewerPlayer) {
        // Pas d'action IA : on renvoie un MISS neutre (pas de coord) pour conserver le contrat.
        return build(ActionResult.MISS, controller, viewerPlayer, null);
    }

    public static ActionResult actionResultFromShot(ShotResult shotResult) {
        return switch (shotResult) {
            case MISS         -> ActionResult.MISS;
            case HIT          -> ActionResult.HIT;
            case SUNK         -> ActionResult.SUNK;
            case ALREADY_HIT  -> ActionResult.ALREADY_HIT;
            case ALREADY_MISS -> ActionResult.ALREADY_MISS;
        };
    }

    public static String messageFor(ActionResult result) {
        return switch (result) {
            case MISS          -> "A l'eau";
            case HIT           -> "Touche";
            case SUNK          -> "Coule";
            case ALREADY_HIT   -> "Case deja touchee";
            case ALREADY_MISS  -> "Case deja visee (a l'eau)";
            case PLACED        -> "Navire place avec succes";
            case REMOVED       -> "Navire retire avec succes";
            case CONFIRMED     -> "Placement valide";
        };
    }

    private static ActionResponse build(ActionResult result, GameController controller,
                                         int viewerPlayer, ShotOutcome outcome) {
        GameStateResponse state = ApiGameStatePresenter.project(controller, viewerPlayer);
        Integer shooter = outcome == null ? null : outcome.shooter();
        Integer target = outcome == null ? null : outcome.targetPlayer();
        Integer x = outcome == null ? null : outcome.x();
        Integer y = outcome == null ? null : outcome.y();
        return new ActionResponse(result, messageFor(result), state, shooter, target, x, y);
    }
}
