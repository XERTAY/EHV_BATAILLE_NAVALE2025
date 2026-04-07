export const BOARD_CONFIGS = {
  faceoff: [
    { boardId: 'A1', position: [0, 0, -70], rotationY: 0 },
    { boardId: 'B1', position: [0, 0, 70], rotationY: Math.PI },
  ],
  star4: [
    {
      boardId: 'A1',
      position: [-112, 0, 0],
      rotationY: -Math.PI / 2,
      flipColumns: true,
      flipRows: true,
      swapColumnLabelSide: true,
      swapRowLabelSide: true,
    },
    {
      boardId: 'B1',
      position: [112, 0, 0],
      rotationY: Math.PI / 2,
      flipColumns: true,
      flipRows: true,
      swapColumnLabelSide: true,
      swapRowLabelSide: true,
    },
    { boardId: 'C1', position: [0, 0, -112], rotationY: 0 },
    { boardId: 'D1', position: [0, 0, 112], rotationY: Math.PI },
  ],
}
