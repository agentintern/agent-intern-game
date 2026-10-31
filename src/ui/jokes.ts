export interface WallText {
  tx: number;
  ty: number;
  text: string;
}

// Sticky notes sit on desks. Walk past one to read it.
export const NOTES: readonly WallText[] = [
  { tx: 11, ty: 2, text: 'DO NOT CIRCLE BACK' },
  { tx: 22, ty: 2, text: 'MY OTHER DESK IS ALSO FULL' },
  { tx: 4, ty: 9, text: 'WHO KEEPS LABELING MY LUNCH' },
  { tx: 34, ty: 11, text: 'TODO: FIND OUT WHAT I DO HERE' },
  { tx: 6, ty: 15, text: 'BACK IN 5 (SINCE MARCH)' },
  { tx: 18, ty: 21, text: 'ROBOTS CAN HAVE LUNCH TOO. ASK HR.' },
];

export const POSTERS: readonly WallText[] = [
  { tx: 2, ty: 0, text: 'SYNERGY' },
  { tx: 0, ty: 19, text: 'BE THE KPI' },
  { tx: 8, ty: 19, text: 'BLAME LATER' },
  { tx: 35, ty: 19, text: 'NO WEEKENDS' },
];
