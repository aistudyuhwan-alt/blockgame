"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// 블록 모양 정의 (matrix: 2차원 배열)
export interface ShapeDefinition {
  id: string;
  name: string;
  color: string;
  matrix: number[][]; // 1: 블록, 0: 빈칸
}

export const SHAPES: ShapeDefinition[] = [
  // 1x1
  {
    id: "dot",
    name: "1x1",
    color: "#f59e0b", // amber
    matrix: [[1]],
  },
  // 1x2, 2x1
  {
    id: "bar2_h",
    name: "1x2",
    color: "#06b6d4", // cyan
    matrix: [[1, 1]],
  },
  {
    id: "bar2_v",
    name: "2x1",
    color: "#06b6d4",
    matrix: [[1], [1]],
  },
  // 1x3, 3x1
  {
    id: "bar3_h",
    name: "1x3",
    color: "#3b82f6", // blue
    matrix: [[1, 1, 1]],
  },
  {
    id: "bar3_v",
    name: "3x1",
    color: "#3b82f6",
    matrix: [[1], [1], [1]],
  },
  // 1x4, 4x1
  {
    id: "bar4_h",
    name: "1x4",
    color: "#6366f1", // indigo
    matrix: [[1, 1, 1, 1]],
  },
  {
    id: "bar4_v",
    name: "4x1",
    color: "#6366f1",
    matrix: [[1], [1], [1], [1]],
  },
  // 1x5, 5x1
  {
    id: "bar5_h",
    name: "1x5",
    color: "#8b5cf6", // purple
    matrix: [[1, 1, 1, 1, 1]],
  },
  {
    id: "bar5_v",
    name: "5x1",
    color: "#8b5cf6",
    matrix: [[1], [1], [1], [1], [1]],
  },
  // 2x2 Square
  {
    id: "sq2",
    name: "2x2",
    color: "#10b981", // emerald
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  // 3x3 Square
  {
    id: "sq3",
    name: "3x3",
    color: "#ec4899", // pink
    matrix: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
  },
  // L-shapes (2x2)
  {
    id: "l2_1",
    name: "L 2x2-1",
    color: "#14b8a6", // teal
    matrix: [
      [1, 0],
      [1, 1],
    ],
  },
  {
    id: "l2_2",
    name: "L 2x2-2",
    color: "#14b8a6",
    matrix: [
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: "l2_3",
    name: "L 2x2-3",
    color: "#14b8a6",
    matrix: [
      [1, 1],
      [1, 0],
    ],
  },
  {
    id: "l2_4",
    name: "L 2x2-4",
    color: "#14b8a6",
    matrix: [
      [1, 1],
      [0, 1],
    ],
  },
  // L-shapes (3x3)
  {
    id: "l3_1",
    name: "L 3x3-1",
    color: "#f97316", // orange
    matrix: [
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  {
    id: "l3_2",
    name: "L 3x3-2",
    color: "#f97316",
    matrix: [
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
  {
    id: "l3_3",
    name: "L 3x3-3",
    color: "#f97316",
    matrix: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
  },
  {
    id: "l3_4",
    name: "L 3x3-4",
    color: "#f97316",
    matrix: [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
  },
];

// 환경 변수(.env.local의 NEXT_PUBLIC_GOOGLE_SCRIPT_URL)에서 구글 앱스 스크립트 웹 앱 URL을 가져옵니다.
const DEFAULT_GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";

export interface PieceSlot {
  uid: string; // 고유 식별자
  shape: ShapeDefinition;
  used: boolean;
}

export type GameState = "START" | "PLAYING" | "PAUSED" | "GAMEOVER";

export interface CellData {
  filled: boolean;
  color: string;
}

export interface Ranker {
  rank: number;
  name: string;
  score: number;
  timestamp?: string;
}

const BOARD_SIZE = 8;

export default function BlockPuzzleGame() {
  // 상태 관리
  const [gameState, setGameState] = useState<GameState>("START");
  const [playerName, setPlayerName] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [score, setScore] = useState<number>(0);
  const [board, setBoard] = useState<CellData[][]>(() =>
    Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => ({ filled: false, color: "" }))
    )
  );

  const [pieces, setPieces] = useState<PieceSlot[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ r: number; c: number } | null>(null);

  // 구글 시트 저장 및 상위 3명 랭킹 상태
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [customScriptUrl, setCustomScriptUrl] = useState<string>("");
  const [topRankers, setTopRankers] = useState<Ranker[]>([]);
  const [isLoadingRankers, setIsLoadingRankers] = useState<boolean>(false);

  // 확인 모달
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // 제거 애니메이션 및 점수 플로팅 표시
  const [clearingCells, setClearingCells] = useState<{ r: number; c: number }[]>([]);
  const [floatingScore, setFloatingScore] = useState<{
    id: number;
    points: number;
    x: number;
    y: number;
  } | null>(null);
  const [placementNotice, setPlacementNotice] = useState<string | null>(null);

  const isProcessingRef = useRef(false);

  // 랜덤 조각 3개 생성 함수
  const generateNewPieces = useCallback((): PieceSlot[] => {
    const newPieces: PieceSlot[] = [];
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * SHAPES.length);
      newPieces.push({
        uid: `${Date.now()}-${i}-${Math.random()}`,
        shape: SHAPES[randomIndex],
        used: false,
      });
    }
    return newPieces;
  }, []);

  // 특정 위치(r, c)를 기준점(좌상단 0,0)으로 블록을 배치할 수 있는지 체크
  const canPlaceAt = useCallback(
    (currentBoard: CellData[][], shape: ShapeDefinition, r: number, c: number): boolean => {
      const h = shape.matrix.length;
      const w = shape.matrix[0].length;

      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          if (shape.matrix[i][j] === 1) {
            const targetR = r + i;
            const targetC = c + j;

            // 1. 보드 범위 벗어남
            if (
              targetR < 0 ||
              targetR >= BOARD_SIZE ||
              targetC < 0 ||
              targetC >= BOARD_SIZE
            ) {
              return false;
            }
            // 2. 이미 블록이 차 있음
            if (currentBoard[targetR][targetC].filled) {
              return false;
            }
          }
        }
      }
      return true;
    },
    []
  );

  // 보드 전체에서 해당 shape를 배치할 수 있는 자리가 최소 1곳이라도 있는지 검사
  const canPlaceSomewhere = useCallback(
    (currentBoard: CellData[][], shape: ShapeDefinition): boolean => {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (canPlaceAt(currentBoard, shape, r, c)) {
            return true;
          }
        }
      }
      return false;
    },
    [canPlaceAt]
  );

  // 게임 오버 여부 검사: 남아있는 블록 중 배치 가능한 블록이 단 하나도 없는 경우
  const checkGameOver = useCallback(
    (currentBoard: CellData[][], currentPieces: PieceSlot[]): boolean => {
      const activePieces = currentPieces.filter((p) => !p.used);
      if (activePieces.length === 0) {
        return false;
      }
      for (const piece of activePieces) {
        if (canPlaceSomewhere(currentBoard, piece.shape)) {
          return false; // 아직 놓을 수 있는 블록이 존재함
        }
      }
      return true; // 아무것도 놓을 수 없음
    },
    [canPlaceSomewhere]
  );

  // 게임 시작 처리
  const handleStartGame = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setErrorMessage("사용자 이름을 입력해주세요 (공백 불가)");
      return;
    }
    setErrorMessage("");
    setPlayerName(trimmed);
    initGame();
  };

  // 게임 초기화
  const initGame = () => {
    const newBoard = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => ({ filled: false, color: "" }))
    );
    const initialPieces = generateNewPieces();
    setBoard(newBoard);
    setScore(0);
    setPieces(initialPieces);
    setSelectedIndex(null);
    setHoverCoord(null);
    setClearingCells([]);
    setFloatingScore(null);
    setPlacementNotice(null);
    setSaveStatus("idle");
    setGameState("PLAYING");
    isProcessingRef.current = false;
  };

  // 블록 조각 선택 토글
  const handleSelectPiece = (index: number) => {
    if (gameState !== "PLAYING" || isProcessingRef.current) return;
    if (pieces[index].used) return;

    if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      setSelectedIndex(index);
    }
  };

  // 안내 메시지 표시
  const showNotice = (msg: string) => {
    setPlacementNotice(msg);
    setTimeout(() => {
      setPlacementNotice((prev) => (prev === msg ? null : prev));
    }, 1500);
  };

  // 보드 셀 클릭하여 블록 배치
  const handleCellClick = (r: number, c: number) => {
    if (gameState !== "PLAYING" || isProcessingRef.current) return;
    if (selectedIndex === null) {
      showNotice("먼저 아래에서 배치할 블록 조각을 선택해주세요.");
      return;
    }

    const currentPiece = pieces[selectedIndex];
    if (!currentPiece || currentPiece.used) return;

    // 배치 가능 여부 확인
    if (!canPlaceAt(board, currentPiece.shape, r, c)) {
      showNotice("이 위치에는 블록을 배치할 수 없습니다!");
      return;
    }

    // 중복 클릭 방지 락
    isProcessingRef.current = true;

    // 1. 블록 보드에 배치
    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
    const shape = currentPiece.shape;
    for (let i = 0; i < shape.matrix.length; i++) {
      for (let j = 0; j < shape.matrix[0].length; j++) {
        if (shape.matrix[i][j] === 1) {
          newBoard[r + i][c + j] = {
            filled: true,
            color: shape.color,
          };
        }
      }
    }

    // 2. 조각 사용 처리
    let updatedPieces = pieces.map((p, idx) =>
      idx === selectedIndex ? { ...p, used: true } : p
    );
    setSelectedIndex(null);
    setHoverCoord(null);

    // 3. 가득 찬 행과 열 검사
    const fullRows: number[] = [];
    for (let rowIdx = 0; rowIdx < BOARD_SIZE; rowIdx++) {
      if (newBoard[rowIdx].every((cell) => cell.filled)) {
        fullRows.push(rowIdx);
      }
    }

    const fullCols: number[] = [];
    for (let colIdx = 0; colIdx < BOARD_SIZE; colIdx++) {
      let colFull = true;
      for (let rowIdx = 0; rowIdx < BOARD_SIZE; rowIdx++) {
        if (!newBoard[rowIdx][colIdx].filled) {
          colFull = false;
          break;
        }
      }
      if (colFull) {
        fullCols.push(colIdx);
      }
    }

    // 제거할 고유 셀 좌표 집합 (교차점 중복 방지)
    const cellsToClear: { r: number; c: number }[] = [];
    const cellKeySet = new Set<string>();

    for (const rIdx of fullRows) {
      for (let cIdx = 0; cIdx < BOARD_SIZE; cIdx++) {
        const key = `${rIdx},${cIdx}`;
        if (!cellKeySet.has(key)) {
          cellKeySet.add(key);
          cellsToClear.push({ r: rIdx, c: cIdx });
        }
      }
    }

    for (const cIdx of fullCols) {
      for (let rIdx = 0; rIdx < BOARD_SIZE; rIdx++) {
        const key = `${rIdx},${cIdx}`;
        if (!cellKeySet.has(key)) {
          cellKeySet.add(key);
          cellsToClear.push({ r: rIdx, c: cIdx });
        }
      }
    }

    const pointsGained = cellsToClear.length; // 실제 제거된 칸 1개당 1점

    if (pointsGained > 0) {
      // 보드 즉시 반영 후 클리어 애니메이션 시작
      setBoard(newBoard);
      setClearingCells(cellsToClear);
      setFloatingScore({
        id: Date.now(),
        points: pointsGained,
        x: c,
        y: r,
      });

      // 애니메이션 진행 (350ms) 후 보드에서 삭제 및 점수 가산
      setTimeout(() => {
        for (const cell of cellsToClear) {
          newBoard[cell.r][cell.c] = { filled: false, color: "" };
        }
        setBoard(newBoard);
        setClearingCells([]);
        const nextScore = score + pointsGained;
        setScore(nextScore);

        finishTurn(newBoard, updatedPieces, nextScore);
      }, 350);
    } else {
      // 제거된 줄이 없는 경우 (블록 단순 배치 점수는 0점)
      setBoard(newBoard);
      finishTurn(newBoard, updatedPieces, score);
    }
  };

  // JSONP 방식으로 상위 3명 순위 불러오기 (브라우저 CORS 완벽 우회)
  const fetchTop3Rankers = (url: string) => {
    setIsLoadingRankers(true);

    const callbackName = `getTop3Callback_${Date.now()}`;
    const script = document.createElement("script");
    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${callbackName}`;

    // 전역 콜백 등록
    (window as unknown as Record<string, unknown>)[callbackName] = (data: { top3?: Ranker[] }) => {
      if (data && Array.isArray(data.top3)) {
        setTopRankers(data.top3);
      }
      setIsLoadingRankers(false);
      // 정리
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };

    script.onerror = () => {
      console.warn("JSONP 상위 랭킹 조회 실패, fetch fallback 시도");
      // fetch fallback
      fetch(url, { method: "GET" })
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.top3)) {
            setTopRankers(data.top3);
          }
        })
        .catch((e) => console.warn("GET 실패:", e))
        .finally(() => setIsLoadingRankers(false));

      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };

    document.body.appendChild(script);
  };

  // 구글 시트에 점수 전송 함수 (게임 정상 종료 시에만 호출)
  const saveScoreToGoogleSheet = async (finalScore: number, finalName: string) => {
    const targetUrl = customScriptUrl.trim() || DEFAULT_GOOGLE_SCRIPT_URL.trim();
    if (!targetUrl) {
      console.warn("구글 앱스 스크립트 URL이 설정되지 않아 점수가 저장되지 않습니다 (.env.local 확인)");
      return;
    }

    setSaveStatus("saving");
    setIsLoadingRankers(true);

    try {
      // 1. 점수 등록 POST 요청 전송
      await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          name: finalName,
          score: finalScore,
        }),
        mode: "no-cors",
      });

      setSaveStatus("saved");

      // 2. 점수 등록 후 상위 3명 순위를 가져오기 위한 요청 (스프레드시트 처리 지연 감안 800ms)
      setTimeout(() => {
        fetchTop3Rankers(targetUrl);
      }, 800);

    } catch (err) {
      console.error("구글 시트 저장 실패:", err);
      setSaveStatus("error");
      setIsLoadingRankers(false);
    }
  };

  // 턴 마무리: 3개 모두 소진 시 재생성 & 게임 오버 체크
  const finishTurn = (
    currentBoard: CellData[][],
    currentPieces: PieceSlot[],
    latestScore: number
  ) => {
    let nextPieces = currentPieces;
    const allUsed = currentPieces.every((p) => p.used);
    if (allUsed) {
      nextPieces = generateNewPieces();
      setPieces(nextPieces);
    } else {
      setPieces(currentPieces);
    }

    // 게임 오버 검사
    if (checkGameOver(currentBoard, nextPieces)) {
      setGameState("GAMEOVER");
      // 최신 점수(latestScore)와 플레이어 이름으로 구글 시트에 안전하게 전송
      saveScoreToGoogleSheet(latestScore, playerName);
    }

    isProcessingRef.current = false;
  };

  // 마우스 호버 시 프리뷰 좌표 계산
  const getPreviewState = (r: number, c: number) => {
    if (selectedIndex === null || gameState !== "PLAYING" || hoverCoord === null) {
      return null;
    }
    const currentPiece = pieces[selectedIndex];
    if (!currentPiece || currentPiece.used) return null;

    const baseR = hoverCoord.r;
    const baseC = hoverCoord.c;
    const isValid = canPlaceAt(board, currentPiece.shape, baseR, baseC);

    const shape = currentPiece.shape;
    const h = shape.matrix.length;
    const w = shape.matrix[0].length;

    // 현재 셀(r, c)이 프리뷰에 포함되는지 확인
    const relR = r - baseR;
    const relC = c - baseC;

    if (relR >= 0 && relR < h && relC >= 0 && relC < w) {
      if (shape.matrix[relR][relC] === 1) {
        return {
          isInShape: true,
          isValid,
        };
      }
    }
    return null;
  };

  // 일시정지 / 계속하기 토글
  const togglePause = () => {
    if (gameState === "PLAYING") {
      setGameState("PAUSED");
      setSelectedIndex(null);
    } else if (gameState === "PAUSED") {
      setGameState("PLAYING");
    }
  };

  // 다시 시작 확인
  const handleRestartConfirm = () => {
    setConfirmDialog({
      open: true,
      title: "게임 다시 시작",
      message: "현재 진행 중인 게임과 점수가 초기화됩니다. 다시 시작하시겠습니까?",
      onConfirm: () => {
        setConfirmDialog(null);
        initGame();
      },
    });
  };

  // 처음으로 확인
  const handleHomeConfirm = () => {
    setConfirmDialog({
      open: true,
      title: "시작 화면으로 이동",
      message: "진행 중인 게임 내용이 모두 초기화됩니다. 처음으로 돌아가시겠습니까?",
      onConfirm: () => {
        setConfirmDialog(null);
        setGameState("START");
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 select-none font-sans">
      {/* 1. 시작 화면 */}
      {gameState === "START" && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full px-4 animate-pop">
          <div className="w-20 h-20 mb-4 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-900/60 rounded-xl">
              <div className="w-4 h-4 rounded bg-amber-400"></div>
              <div className="w-4 h-4 rounded bg-cyan-400"></div>
              <div className="w-4 h-4 rounded bg-emerald-400"></div>
              <div className="w-4 h-4 rounded bg-pink-400"></div>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-center tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-pink-400">
            8×8 블록 퍼즐
          </h1>
          <p className="text-slate-400 text-sm text-center mb-8">
            가득 찬 행과 열을 완성하여 블록을 제거하고 점수를 획득하세요!
          </p>

          <div className="w-full bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                플레이어 이름
              </label>
              <input
                type="text"
                placeholder="이름을 입력하세요"
                value={nameInput}
                maxLength={15}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleStartGame();
                }}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-white font-medium placeholder-slate-500 transition-all text-base"
              />
              {errorMessage && (
                <p className="text-rose-400 text-xs mt-2 font-medium flex items-center gap-1">
                  <span>⚠️</span> {errorMessage}
                </p>
              )}
            </div>

            {/* 구글 시트 연동 설정 정보 */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-400">
                  구글 앱스 스크립트 웹 앱 URL
                </label>
                {DEFAULT_GOOGLE_SCRIPT_URL ? (
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                    .env.local 연동됨
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded">
                    .env.local 미설정
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder={DEFAULT_GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/.../exec"}
                value={customScriptUrl}
                onChange={(e) => setCustomScriptUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 focus:border-indigo-500 focus:outline-none text-xs text-slate-200 placeholder-slate-500 font-mono transition-all"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {DEFAULT_GOOGLE_SCRIPT_URL
                  ? "* .env.local 환경변수가 기본 적용되며, 필요 시 직접 다른 URL을 입력하여 재정의할 수 있습니다."
                  : "* .env.local 파일의 NEXT_PUBLIC_GOOGLE_SCRIPT_URL 값을 설정하거나 여기에 직접 입력하세요."}
              </p>
            </div>

            <button
              onClick={handleStartGame}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-[0.98] shadow-lg shadow-indigo-500/25 transition-all text-lg cursor-pointer"
            >
              게임 시작
            </button>
          </div>

          <div className="mt-8 text-xs text-slate-500 text-center space-y-1">
            <p>• 블록 조각 3개를 보드에 맞춰 전략적으로 배치해보세요.</p>
            <p>• 행이나 열이 꽉 차면 자동으로 블록이 제거됩니다.</p>
          </div>
        </div>
      )}

      {/* 2. 게임 화면 (진행 중 / 일시정지) */}
      {(gameState === "PLAYING" || gameState === "PAUSED") && (
        <div className="w-full max-w-[480px] flex flex-col items-center flex-1 justify-between gap-3">
          {/* 상단 헤더: 유저 정보, 점수, 제어 버튼 */}
          <div className="w-full bg-slate-800/90 border border-slate-700/60 rounded-2xl p-3 sm:p-4 shadow-md backdrop-blur">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center font-bold text-indigo-400 text-sm">
                  {playerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-slate-400">플레이어</div>
                  <div className="text-sm font-bold text-white truncate max-w-[120px] sm:max-w-[160px]">
                    {playerName}
                  </div>
                </div>
              </div>

              {/* 현재 점수 */}
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase tracking-wider">SCORE</div>
                <div className="text-2xl font-black text-amber-400 leading-none">
                  {score.toLocaleString()}
                </div>
              </div>
            </div>

            {/* 제어 버튼 3종 */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/50">
              <button
                onClick={togglePause}
                className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                {gameState === "PAUSED" ? "▶ 계속하기" : "⏸ 일시정지"}
              </button>
              <button
                onClick={handleRestartConfirm}
                className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                🔄 다시 시작
              </button>
              <button
                onClick={handleHomeConfirm}
                className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                🏠 처음으로
              </button>
            </div>
          </div>

          {/* 알림 메시지 배너 */}
          <div className="h-6 flex items-center justify-center">
            {placementNotice && (
              <span className="text-xs font-semibold text-rose-300 bg-rose-950/80 border border-rose-500/50 px-3 py-1 rounded-full animate-pop shadow-md">
                {placementNotice}
              </span>
            )}
          </div>

          {/* 8x8 메인 게임 보드 */}
          <div className="relative w-full aspect-square max-w-[420px] bg-slate-950 p-2 sm:p-2.5 rounded-2xl border-2 border-slate-700/80 shadow-2xl flex flex-col justify-between">
            {/* 점수 획득 팝업 */}
            {floatingScore && (
              <div
                key={floatingScore.id}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <div className="animate-score text-3xl sm:text-4xl font-extrabold text-amber-300 drop-shadow-[0_4px_12px_rgba(245,158,11,0.7)]">
                  +{floatingScore.points}
                </div>
              </div>
            )}

            {/* 8x8 그리드 */}
            <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-1 sm:gap-1.5">
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const preview = getPreviewState(r, c);
                  const isClearing = clearingCells.some(
                    (coord) => coord.r === r && coord.c === c
                  );

                  let cellStyle: React.CSSProperties = {};
                  let cellClass =
                    "relative rounded-md flex items-center justify-center transition-all duration-100 ";

                  if (isClearing) {
                    cellClass += "animate-clear z-20 ";
                    cellStyle = { backgroundColor: cell.color || "#ffffff" };
                  } else if (cell.filled) {
                    // 고정된 블록
                    cellClass += "shadow-sm border border-white/20 ";
                    cellStyle = { backgroundColor: cell.color };
                  } else if (preview && preview.isInShape) {
                    // 프리뷰 표시: 유효하면 초록색, 불가능하면 빨간색
                    if (preview.isValid) {
                      cellClass += "bg-emerald-500/60 border-2 border-emerald-400 z-10 scale-[0.96] ";
                    } else {
                      cellClass += "bg-rose-500/60 border-2 border-rose-400 z-10 scale-[0.96] ";
                    }
                  } else {
                    // 빈 슬롯
                    cellClass +=
                      "bg-slate-800/60 border border-slate-700/40 hover:bg-slate-800 transition-colors ";
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      style={cellStyle}
                      className={cellClass}
                      onClick={() => handleCellClick(r, c)}
                      onMouseEnter={() => setHoverCoord({ r, c })}
                      onMouseLeave={() => setHoverCoord(null)}
                    >
                      {/* 입체감 있는 하이라이트 효과 */}
                      {cell.filled && !isClearing && (
                        <div className="absolute inset-0 rounded-md bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 일시정지 오버레이 */}
            {gameState === "PAUSED" && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-40 p-6 animate-pop">
                <div className="text-4xl mb-3">⏸️</div>
                <h3 className="text-2xl font-black text-white mb-2">게임 일시정지</h3>
                <p className="text-sm text-slate-400 mb-6 text-center">
                  게임이 일시정지되었습니다.<br />계속하려면 아래 버튼을 누르세요.
                </p>
                <button
                  onClick={togglePause}
                  className="py-3 px-8 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  계속하기
                </button>
              </div>
            )}
          </div>

          {/* 하단 블록 조각 3개 선택 영역 */}
          <div className="w-full bg-slate-800/80 border border-slate-700/60 rounded-2xl p-2.5 sm:p-3 shadow-lg">
            <div className="text-xs text-slate-400 mb-2 font-medium text-center">
              {selectedIndex === null
                ? "보드에 배치할 블록을 1개 선택하세요"
                : "보드의 원하는 위치를 클릭(터치)해 배치하세요"}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 h-28 sm:h-32">
              {pieces.map((pieceSlot, idx) => {
                const isSelected = selectedIndex === idx;
                const isUsed = pieceSlot.used;
                const shape = pieceSlot.shape;

                if (isUsed) {
                  return (
                    <div
                      key={pieceSlot.uid}
                      className="rounded-xl border border-dashed border-slate-700/50 bg-slate-900/30 flex items-center justify-center opacity-30 cursor-not-allowed"
                    >
                      <span className="text-xs text-slate-600 font-bold">사용됨</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={pieceSlot.uid}
                    onClick={() => handleSelectPiece(idx)}
                    className={`rounded-xl border-2 p-1.5 flex items-center justify-center cursor-pointer transition-all ${
                      isSelected
                        ? "border-amber-400 bg-amber-400/10 shadow-md shadow-amber-400/20 scale-105"
                        : "border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900"
                    }`}
                  >
                    {/* 블록 모양 미니 그리드 렌더링 */}
                    <div
                      className="grid gap-0.5 sm:gap-1"
                      style={{
                        gridTemplateRows: `repeat(${shape.matrix.length}, minmax(0, 1fr))`,
                        gridTemplateColumns: `repeat(${shape.matrix[0].length}, minmax(0, 1fr))`,
                      }}
                    >
                      {shape.matrix.map((row, rIdx) =>
                        row.map((val, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className={`w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-[3px] transition-all ${
                              val === 1 ? "border border-white/20 shadow-sm" : "opacity-0"
                            }`}
                            style={{
                              backgroundColor: val === 1 ? shape.color : "transparent",
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. 게임 오버 / 결과 화면 */}
      {gameState === "GAMEOVER" && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full px-4 animate-pop">
          <div className="w-full bg-slate-800/90 border border-slate-700/70 rounded-2xl p-6 sm:p-8 shadow-2xl text-center backdrop-blur">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl">
              💥
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
              게임 종료
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              더 이상 블록을 배치할 수 있는 공간이 없습니다!
            </p>

            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/50 mb-6 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">플레이어</span>
                <span className="font-bold text-slate-200">{playerName}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-slate-400">최종 획득 점수</span>
                <span className="text-3xl font-black text-amber-400">
                  {score.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 ml-1">점</span>
                </span>
              </div>
            </div>

            {/* 구글 시트 저장 상태 알림 */}
            <div className="mb-4 text-xs text-center">
              {saveStatus === "saving" && (
                <div className="text-indigo-400 animate-pulse flex items-center justify-center gap-1.5 font-medium">
                  <span>📊</span> 구글 시트에 기록 저장 중...
                </div>
              )}
              {saveStatus === "saved" && (
                <div className="text-emerald-400 flex items-center justify-center gap-1.5 font-medium">
                  <span>✅</span> 구글 스프레드시트에 성공적으로 저장되었습니다!
                </div>
              )}
              {saveStatus === "error" && (
                <div className="text-rose-400 flex items-center justify-center gap-1.5 font-medium">
                  <span>⚠️</span> 구글 시트 저장 실패 (URL 또는 권한 확인)
                </div>
              )}
            </div>

            {/* 🏆 상위 3명 순위 (Top 3 명예의 전당) */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-amber-500/30 mb-6 shadow-inner">
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                  <span>🏆</span> 명예의 전당 (Top 3 랭킹)
                </div>
                {isLoadingRankers && (
                  <span className="text-[10px] text-slate-400 animate-spin">⏳</span>
                )}
              </div>

              {topRankers.length > 0 ? (
                <div className="space-y-1.5">
                  {topRankers.map((ranker, i) => {
                    const badge =
                      ranker.rank === 1
                        ? "🥇 1위"
                        : ranker.rank === 2
                        ? "🥈 2위"
                        : ranker.rank === 3
                        ? "🥉 3위"
                        : `${ranker.rank}위`;
                    const isMe = ranker.name === playerName && ranker.score === score;

                    return (
                      <div
                        key={`${ranker.rank}-${ranker.name}-${i}`}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isMe
                            ? "bg-amber-500/20 border border-amber-400/40 text-amber-200"
                            : "bg-slate-800/60 border border-slate-700/50 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[13px]">{badge}</span>
                          <span className="font-semibold truncate max-w-[100px] sm:max-w-[130px]">
                            {ranker.name}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-amber-400">
                          {ranker.score.toLocaleString()}
                          <span className="text-[10px] text-slate-400 ml-0.5 font-normal">점</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-slate-500">
                  {isLoadingRankers ? "랭킹 데이터를 불러오는 중..." : "아직 기록된 랭킹 데이터가 없습니다."}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={initGame}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/30 cursor-pointer text-base"
              >
                🔄 다시 시작
              </button>
              <button
                onClick={() => setGameState("START")}
                className="w-full py-3 px-4 rounded-xl font-semibold text-slate-300 bg-slate-700/70 hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer text-sm"
              >
                🏠 처음으로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확인 모달 다이얼로그 */}
      {confirmDialog && confirmDialog.open && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-pop">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h4 className="text-lg font-bold text-white mb-2">
              {confirmDialog.title}
            </h4>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 푸터 */}
      <footer className="text-[11px] text-slate-500 text-center py-2">
        8×8 Block Puzzle Web Game • Next.js & Tailwind CSS
      </footer>
    </div>
  );
}
