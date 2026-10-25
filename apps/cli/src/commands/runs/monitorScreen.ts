import { listedTasks } from './monitorBoard';
import { createCanvas } from './monitorCanvas';
import { drawHelp, drawNeedsDialog, drawPalette, drawTaskDialog, paletteFound, paletteItems } from './monitorDialogs';
import { drawHead, drawStatus, HEAD_ROWS } from './monitorHead';
import { drawNeeds, needsRows, shownNeeds } from './monitorNeeds';
import { drawOverviewMain } from './monitorOverview';
import { drawSide } from './monitorSide';
import { agentHues } from './monitorTheme';
import { drawAgentsView, drawFlowView, drawSpendView, drawTasksView } from './monitorViews';

import type { Need } from './monitorAttention';
import type { Canvas } from './monitorCanvas';
import type { PaletteItem } from './monitorDialogs';
import type { Area, Hit, MonitorUi, Paint, PreviewShown } from './monitorModel';
import type { Theme } from './monitorTheme';
import type { Monitored } from '../../runs/monitor';

/**
 * `plitzi run monitor`'s screen: the head (the run, the views, the strip), the view asked, what needs someone, the
 * status bar — and a dialog over them all when one is open. Drawn whole on every frame from the run and where the
 * person is in it; what a click or the wheel reaches is answered with it.
 */

/** From this width the Overview has its sidebar; under it the tasks and agents are their own views. */
export const SIDEBAR_FROM = 130;

export interface Screen {
  canvas: Canvas;
  hits: Hit[];
  areas: Area[];
  needs: Need[];
}

const sideWidth = (width: number): number => Math.min(60, Math.max(46, Math.floor(width * 0.32)));

/** The palette's items as `query` finds them: what the screen lists, and what ⏎ runs. */
export const paletteFor = (data: Monitored, ui: MonitorUi, theme: Theme, needs: readonly Need[]): PaletteItem[] => {
  const p: Paint = {
    canvas: createCanvas(1, 1, theme),
    theme,
    hues: agentHues(
      theme,
      data.agents.map(agent => agent.agent)
    ),
    now: new Date(),
    hits: [],
    areas: []
  };

  return paletteFound(paletteItems(p, data, needs), ui.dialog?.kind === 'palette' ? ui.dialog.query : '');
};

export const monitorScreen = (
  data: Monitored,
  ui: MonitorUi,
  {
    width,
    height,
    now,
    theme,
    preview
  }: { width: number; height: number; now: Date; theme: Theme; preview: PreviewShown }
): Screen => {
  const canvas = createCanvas(width, height, theme);
  const p: Paint = {
    canvas,
    theme,
    hues: agentHues(
      theme,
      data.agents.map(agent => agent.agent)
    ),
    now,
    hits: [],
    areas: []
  };
  drawHead(p, data, ui, width);
  const needs = shownNeeds(data, ui);
  const boxRows = needsRows(needs, height);
  const statusRow = height - 1;
  const boxTop = statusRow - boxRows;
  const top = HEAD_ROWS + 1;
  const body = { top, left: 0, width, height: Math.max(4, boxTop - top - (boxRows > 0 ? 1 : 0)) };
  if (ui.view === 'overview') {
    const wide = width >= SIDEBAR_FROM;
    const side = wide ? sideWidth(width) : 0;
    drawOverviewMain(p, data, ui, preview, { ...body, width: width - side - (wide ? 3 : 2) }, !wide);
    if (wide) {
      drawSide(p, data, ui, preview, { ...body, left: width - side - 1, width: side });
    }
  } else if (ui.view === 'flow') {
    drawFlowView(p, data, ui, body);
  } else if (ui.view === 'tasks') {
    drawTasksView(p, data, ui, body);
  } else if (ui.view === 'agents') {
    drawAgentsView(p, data, body);
  } else {
    drawSpendView(p, data, ui, body);
  }

  drawNeeds(p, needs, ui, boxTop, boxRows, width);
  drawStatus(p, data, ui, preview, width, statusRow);

  const { dialog } = ui;
  if (dialog?.kind === 'task') {
    const task = listedTasks(data.view.tasks, ui.showApproved).at(ui.selected);
    if (task) {
      drawTaskDialog(p, data, task);
    }
  } else if (dialog?.kind === 'help') {
    drawHelp(p);
  } else if (dialog?.kind === 'needs') {
    drawNeedsDialog(p, needs);
  } else if (dialog?.kind === 'palette') {
    drawPalette(p, paletteFound(paletteItems(p, data, needs), dialog.query), dialog.query, dialog.at);
  }

  return { canvas, hits: dialog ? [] : p.hits, areas: dialog ? [] : p.areas, needs };
};
