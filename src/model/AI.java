import java.util.List;
import java.util.Random;
import java.io.Serializable;


public class AI extends Player {

    private final Random random = new Random();

    public AI(String name, int gridSize, List<Integer> shipSizes) {
        super(name, gridSize, shipSizes);
    }

    @Override
    public boolean isAI() {
        return true;
    }

    public void autoPlaceFleet(GameController controller) {

        int gridSize = controller.getGridSize();
        
        for (int size : getFleet().getShips().stream().map(Ship::getSize).toList())
         {

            boolean placed = false;

            while (!placed) {

                int x = random.nextInt(gridSize);
                int y = random.nextInt(gridSize);

                ShipOrientation orientation =
                        ShipOrientation.values()[
                                random.nextInt(
                                    ShipOrientation.values().length
                                )
                        ];

                if (controller.canPlaceShip(x, y, size, orientation)) {

                    controller.placeShip(
                            x,
                            y,
                            size,
                            orientation,
                            "AI-" + size
                    );

                    placed = true;
                }
            }
        }
    }
}