import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RootElement, useChannel, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

import './Board.css';

import { FILLS, STROKES, STROKE_WIDTHS } from '../../board/model.ts';
import { isCollaborator } from '../../board/people.ts';
import { TOOLS, createBoardController } from './controller.ts';
import declaration from './declaration';

import type { BoardController, ControllerEvent, PointerMessage, ScreenBox, TextEditor, Tool } from './controller.ts';
import type { BoardElement, Fill, Stroke, StrokeWidth } from '../../board/model.ts';
import type { Collaborator } from '../../board/people.ts';
import type { InteractionCallback, RealtimeMessage } from '@plitzi/plitzi-sdk';
import type { ChangeEvent, CSSProperties, KeyboardEvent, ReactNode } from 'react';

export type BoardProps = {
  /** Which board this is: a new id starts the canvas over, the same id merges what it is given. */
  boardId?: string;
  /** The board as the server keeps it. An array from a binding; JSON text when somebody typed it in the builder. */
  elements?: BoardElement[] | string;
  /** The channel the server announces saved elements on — `board:{{ id }}`. */
  topic?: string;
  /** The channel cursors and live drags travel on — `room:{{ id }}`. */
  roomTopic?: string;
  /** The board's name: what an exported image is called. */
  title?: string;
  /** Where the board's pictures are served from: `/board-assets/<board>`. */
  assetBase?: string;
  /** The id this visitor keeps: their votes are counted by it, and lit on the badges. */
  voter?: string;
  /** `edit`, or `view` — a still preview that fits the drawing, takes no pointer and connects to nothing. */
  mode?: 'edit' | 'view';
  tool?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number | string;
  /** The page's colour scheme. Its value is not read — its CHANGE is when the canvas reads its colours again. */
  scheme?: string;
  className?: string;
  /** The selection's tools, authored by the space: laid beside whatever is selected, and hidden while nothing is. */
  children?: ReactNode;
};

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

/** How often this page tells the room where its pointer is: often enough to look live, well under the channel's cap. */
const POINTER_MS = 50;

/** How far the selection's tools stand from what is selected, and how close to the top they may go before flipping below. */
const TOOLS_GAP = 12;

const TOOLS_ROOM = 64;

/** A draft bigger than this travels as a cursor alone: the others see the drag land when it is committed. */
const DRAFT_BYTES = 6000;

const isOneOf = <T extends string | number>(values: readonly T[], value: unknown): value is T =>
  values.some(entry => entry === value);

const elementsOf = (value: BoardProps['elements']): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * The whiteboard's canvas: the one part of the board that cannot be arranged out of boxes.
 *
 * **It keeps nothing.** Every change is `onCommit`, which the page sends to a server action; the action validates it,
 * keeps it and announces it on the board's channel, and that announcement — heard here like everyone else's — is
 * what confirms it. Until then the edit is drawn on top of what the server confirmed, and `rollback` drops it.
 *
 * **Two channels, two speeds.** Saved elements arrive on `topic`, where only the server may speak. Cursors, live drags
 * and what each person has selected travel on `roomTopic`, straight between pages, twenty times a second — read
 * through `useChannel` rather than through flows, because a flow per cursor movement is a flow too many.
 *
 * **Who is who** comes from the room's presence: the `channel` element around the canvas announces this page's name
 * and colour, and every page on the room shares what it heard.
 */
const Board = ({
  boardId = '',
  elements,
  topic = '',
  roomTopic = '',
  title = '',
  assetBase = '',
  voter = '',
  mode = 'edit',
  tool = 'select',
  stroke = 'ink',
  fill = 'none',
  strokeWidth = 2,
  scheme = '',
  className,
  children
}: BoardProps) => {
  const { id } = useElement();
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<BoardController | undefined>(undefined);
  const [editor, setEditor] = useState<TextEditor | undefined>(undefined);
  const [selectionBox, setSelectionBox] = useState<ScreenBox | undefined>(undefined);
  const [chatAt, setChatAt] = useState<{ left: number; top: number } | undefined>(undefined);
  const live = mode === 'edit' && previewMode;

  const trigger = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      void interactionsManager.interactionTrigger(id, action, payload);
    },
    [id, interactionsManager]
  );

  // The room's pointer traffic: the latest message wins, sent at most every POINTER_MS — and a final one at once.
  const pending = useRef<PointerMessage | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const roomRef = useRef<((message: PointerMessage) => void) | undefined>(undefined);
  const reactRef = useRef<((reaction: { emoji: string; x: number; y: number }) => void) | undefined>(undefined);
  const summonRef = useRef<((view: [number, number, number, number]) => void) | undefined>(undefined);
  const flushPointer = useCallback(() => {
    timer.current = undefined;
    const message = pending.current;
    pending.current = undefined;
    if (!message) {
      return;
    }

    const light =
      message.draft && JSON.stringify(message.draft).length > DRAFT_BYTES ? { ...message, draft: null } : message;
    roomRef.current?.(light);
  }, []);

  const onEvent = useCallback(
    (event: ControllerEvent) => {
      switch (event.type) {
        case 'commit':
          trigger(declaration.triggers.onCommit.action, { ops: event.ops, count: event.ops.length });
          break;
        case 'tool':
          trigger(declaration.triggers.onToolChange.action, { tool: event.tool });
          break;
        case 'selection':
          trigger(declaration.triggers.onSelectionChange.action, {
            count: event.count,
            grouped: event.grouped,
            oneGroup: event.oneGroup,
            stroke: event.stroke,
            fill: event.fill,
            strokeWidth: event.strokeWidth
          });
          break;
        case 'view':
          trigger(declaration.triggers.onViewChange.action, { zoom: event.zoom });
          break;
        case 'editor':
          setEditor(event.editor);
          break;
        case 'selectionBox':
          setSelectionBox(event.box);
          break;
        case 'follow':
          trigger(declaration.triggers.onFollowChange.action, { name: event.name });
          break;
        case 'reaction':
          reactRef.current?.(event.reaction);
          break;
        case 'image':
          trigger(declaration.triggers.onImagePaste.action, { id: event.id, data: event.data });
          break;
        case 'vote':
          trigger(declaration.triggers.onVote.action, { id: event.id });
          break;
        case 'chat':
          setChatAt(event.at);
          break;
        case 'summon':
          summonRef.current?.(event.view);
          break;
        case 'summoned':
          trigger(declaration.triggers.onSummoned.action, { name: event.name });
          break;
        case 'pointer':
          pending.current = event.message;
          if (event.final) {
            clearTimeout(timer.current);
            flushPointer();
          } else if (!timer.current) {
            timer.current = setTimeout(flushPointer, POINTER_MS);
          }

          break;
      }
    },
    [flushPointer, trigger]
  );

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) {
      return undefined;
    }

    const controller = createBoardController(canvas, host, event => onEventRef.current(event));
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = undefined;
      clearTimeout(timer.current);
    };
  }, []);

  const props = useMemo(() => {
    const width = Number(strokeWidth);

    return {
      tool: isOneOf<Tool>(TOOLS, tool) ? tool : 'select',
      stroke: isOneOf<Stroke>(STROKES, stroke) ? stroke : 'ink',
      fill: isOneOf<Fill>(FILLS, fill) ? fill : 'none',
      strokeWidth: isOneOf<StrokeWidth>(STROKE_WIDTHS, width) ? width : 2,
      mode: live ? ('edit' as const) : ('view' as const),
      title,
      assetBase,
      voter
    };
  }, [tool, stroke, fill, strokeWidth, live, title, assetBase, voter]);
  useEffect(() => controllerRef.current?.setProps(props), [props]);

  // Read again once the new scheme's custom properties are in place — the frame after the change, not during it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => controllerRef.current?.repaint());

    return () => cancelAnimationFrame(frame);
  }, [scheme]);

  const snapshot = useMemo(() => elementsOf(elements), [elements]);
  useEffect(() => controllerRef.current?.load(boardId, snapshot), [boardId, snapshot]);

  // ── The channels ───────────────────────────────────────────────────────────────────────────────────────────────

  const onBoardMessage = useCallback((message: RealtimeMessage) => {
    // Only what the server said is a saved element. The channel is declared `publish: 'server'`, so a page cannot
    // send here at all — checked again because the canvas should not depend on a setting it cannot see.
    if (message.from === 'server' && message.type === 'elements') {
      controllerRef.current?.confirm(message.data);
    }
  }, []);

  const onRoomMessage = useCallback((message: RealtimeMessage) => {
    if (message.type === 'pointer') {
      controllerRef.current?.remotePointer(message.from, message.data);
    } else if (message.type === 'reaction') {
      controllerRef.current?.remoteReaction(message.data);
    } else if (message.type === 'summon') {
      controllerRef.current?.remoteSummon(message.from, message.data);
    }
  }, []);

  const board = useChannel(live && topic ? topic : undefined, { onMessage: onBoardMessage });
  const room = useChannel(live && roomTopic ? roomTopic : undefined, { onMessage: onRoomMessage });

  useEffect(() => {
    roomRef.current = message => void room.publish('pointer', message);
    reactRef.current = reaction => void room.publish('reaction', reaction);
    summonRef.current = view => void room.publish('summon', { view });
  }, [room]);

  useEffect(() => {
    const members = new Map<string, Collaborator>();
    for (const member of room.members) {
      if (!member.me && isCollaborator(member.state)) {
        members.set(member.from, member.state);
      }
    }

    controllerRef.current?.setMembers(members);
  }, [room.members]);

  // A drop means announcements were missed. The page reads the board again; the canvas merges what it is given.
  const everConnected = useRef(false);
  const dropped = useRef(false);
  useEffect(() => {
    if (!board.connected) {
      dropped.current = everConnected.current;

      return;
    }

    everConnected.current = true;
    if (dropped.current) {
      dropped.current = false;
      trigger(declaration.triggers.onResync.action, {});
    }
  }, [board.connected, trigger]);

  // ── What the page asks of it ─────────────────────────────────────────────────────────────────────────────────────

  const callbacks = useMemo<Record<string, InteractionCallback>>(() => {
    const call = (name: keyof typeof declaration.callbacks, run: (controller: BoardController) => void) => ({
      ...declaration.callbacks[name],
      callback: () => {
        const controller = controllerRef.current;
        if (controller) {
          run(controller);
        }
      }
    });

    return {
      undo: call('undo', controller => controller.undo()),
      redo: call('redo', controller => controller.redo()),
      deleteSelection: call('deleteSelection', controller => controller.deleteSelection()),
      selectAll: call('selectAll', controller => controller.selectAll()),
      duplicate: call('duplicate', controller => controller.duplicate()),
      deselect: call('deselect', controller => controller.deselect()),
      bringToFront: call('bringToFront', controller => controller.bringToFront()),
      sendToBack: call('sendToBack', controller => controller.sendToBack()),
      group: call('group', controller => controller.group()),
      ungroup: call('ungroup', controller => controller.ungroup()),
      applyStyle: {
        ...declaration.callbacks.applyStyle,
        callback: (params: { stroke?: unknown; fill?: unknown; strokeWidth?: unknown }) =>
          controllerRef.current?.applyStyle(params)
      },
      zoomIn: call('zoomIn', controller => controller.zoomIn()),
      zoomOut: call('zoomOut', controller => controller.zoomOut()),
      zoomReset: call('zoomReset', controller => controller.zoomReset()),
      zoomToFit: call('zoomToFit', controller => controller.zoomToFit()),
      exportPng: call('exportPng', controller => controller.exportPng()),
      rollback: call('rollback', controller => controller.rollback()),
      carry: {
        ...declaration.callbacks.carry,
        callback: (params: { fill?: unknown }) => controllerRef.current?.carry(params)
      },
      follow: {
        ...declaration.callbacks.follow,
        callback: (params: { from?: unknown }) => controllerRef.current?.follow(params)
      },
      unfollow: call('unfollow', controller => controller.unfollow()),
      react: {
        ...declaration.callbacks.react,
        callback: (params: { emoji?: unknown }) => controllerRef.current?.react(params)
      },
      placeImage: {
        ...declaration.callbacks.placeImage,
        callback: (params: { id?: unknown; asset?: unknown }) => controllerRef.current?.placeImage(params)
      },
      cancelImage: {
        ...declaration.callbacks.cancelImage,
        callback: (params: { id?: unknown }) => controllerRef.current?.cancelImage(params)
      },
      vote: call('vote', controller => controller.vote()),
      chat: call('chat', controller => controller.chat()),
      summon: call('summon', controller => controller.summon())
    };
  }, []);

  // ── The text being typed ───────────────────────────────────────────────────────────────────────────────────────

  const textRef = useRef<HTMLTextAreaElement>(null);
  const editingId = editor?.id;
  useEffect(() => {
    if (editingId) {
      textRef.current?.focus();
    }
  }, [editingId]);

  const onType = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    controllerRef.current?.typeText(event.target.value);
  }, []);

  const onTextKey = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape and ⌘↵ are "done": everything else is the field's.
    if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      textRef.current?.blur();
    }
  }, []);

  const onTextDone = useCallback(() => controllerRef.current?.finishEditing(), []);

  // ── Cursor chat ──────────────────────────────────────────────────────────────────────────────────────────────────

  const chatRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (chatAt) {
      chatRef.current?.focus();
    }
  }, [chatAt]);

  const onChatType = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    controllerRef.current?.typeChat(event.target.value);
  }, []);

  const onChatKey = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    // Enter says it and closes; Escape closes. Either way the words linger a moment on the other screens.
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      chatRef.current?.blur();
    }
  }, []);

  const onChatDone = useCallback(() => controllerRef.current?.closeChat(), []);

  const chatStyle = useMemo<CSSProperties | undefined>(
    () => chatAt && { left: chatAt.left + 16, top: chatAt.top + 18 },
    [chatAt]
  );

  const editorStyle = useMemo<CSSProperties | undefined>(
    () =>
      editor && {
        left: editor.left,
        top: editor.top,
        width: editor.width,
        minHeight: editor.minHeight,
        fontSize: editor.fontSize,
        fontFamily: editor.font,
        color: editor.color,
        padding: editor.padding,
        paddingTop: editor.paddingTop,
        textAlign: editor.align,
        whiteSpace: editor.wraps ? 'pre-wrap' : 'pre'
      },
    [editor]
  );

  // Above the selection, centred on it — or below it when above would run off the top of the board.
  const below = selectionBox !== undefined && selectionBox.top < TOOLS_ROOM;
  const toolsStyle = useMemo<CSSProperties | undefined>(
    () =>
      selectionBox && {
        left: selectionBox.left + selectionBox.width / 2,
        top: below ? selectionBox.top + selectionBox.height + TOOLS_GAP : selectionBox.top - TOOLS_GAP
      },
    [below, selectionBox]
  );

  return (
    <RootElement
      ref={hostRef}
      className={className ? `board__host ${className}` : 'board__host'}
      data-mode={mode}
      interactionTriggers={TRIGGERS}
      interactionCallbacks={callbacks}
    >
      <canvas ref={canvasRef} className="board__canvas" aria-label={title ? `Board: ${title}` : 'Board'} />
      {editor && editorStyle && (
        <textarea
          ref={textRef}
          className="board__editor"
          style={editorStyle}
          defaultValue={editor.text}
          spellCheck={false}
          onChange={onType}
          onKeyDown={onTextKey}
          onBlur={onTextDone}
        />
      )}
      {chatStyle && (
        <input
          ref={chatRef}
          className="board__chat"
          style={chatStyle}
          maxLength={160}
          placeholder="Say something…"
          aria-label="Say something at your cursor"
          onChange={onChatType}
          onKeyDown={onChatKey}
          onBlur={onChatDone}
        />
      )}
      {children && live && toolsStyle && (
        <div className="board__tools" data-placement={below ? 'below' : 'above'} style={toolsStyle}>
          {children}
        </div>
      )}
    </RootElement>
  );
};

export default Board;
