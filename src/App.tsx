/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Layers, 
  CheckCircle, 
  Info, 
  Sparkles, 
  AlertCircle, 
  HelpCircle, 
  BookOpen,
  Check,
  FolderOpen,
  MousePointerClick
} from 'lucide-react';

// Define tree node structure
interface TreeNode {
  id: string;
  value: string;
  left: TreeNode | null;
  right: TreeNode | null;
}

// Define the traversal step event structure
interface TraversalEvent {
  type: 'enter' | 'left' | 'right' | 'visit' | 'backtrack';
  nodeId: string;
  nodeValue: string;
  messageEn: string;
  messageVi: string;
  resultAcquired: string[]; // sequence of outputs up to this point
}

// Layout definitions
interface PositionedNode {
  id: string;
  value: string;
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
  leftId: string | null;
  rightId: string | null;
}

interface ConnectionLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  parentId: string;
  childId: string;
  side: 'left' | 'right';
}

// Constant: The original binary tree from the user's Vietnamese prompt
const ORIGINAL_PRESET_TREE: TreeNode = {
  id: "node-9",
  value: "9",
  left: {
    id: "node-2",
    value: "2",
    left: {
      id: "node-6",
      value: "6",
      left: null,
      right: null
    },
    right: {
      id: "node-1",
      value: "1",
      left: {
        id: "node-10",
        value: "10",
        left: null,
        right: null
      },
      right: null
    }
  },
  right: {
    id: "node-8",
    value: "8",
    left: {
      id: "node-5",
      value: "5",
      left: {
        id: "node-3",
        value: "3",
        left: null,
        right: null
      },
      right: null
    },
    right: {
      id: "node-7",
      value: "7",
      left: {
        id: "node-12",
        value: "12",
        left: null,
        right: null
      },
      right: {
        id: "node-4",
        value: "4",
        left: null,
        right: null
      }
    }
  }
};

// Preset Tree Templates
const TREE_PRESETS = {
  standard: {
    name: "Cây Đề Bài (Standard Tree)",
    desc: "Cây chuẩn từ đề bài bài học với 11 nút và 4 tầng",
    tree: ORIGINAL_PRESET_TREE
  },
  balanced: {
    name: "Cây Cân Bằng (Balanced Tree)",
    desc: "Cây nhị phân hoàn hảo 3 tầng cân bằng đẹp (7 nút)",
    tree: {
      id: "b-1",
      value: "9",
      left: {
        id: "b-2",
        value: "2",
        left: { id: "b-4", value: "6", left: null, right: null },
        right: { id: "b-5", value: "1", left: null, right: null }
      },
      right: {
        id: "b-3",
        value: "8",
        left: { id: "b-6", value: "5", left: null, right: null },
        right: { id: "b-7", value: "7", left: null, right: null }
      }
    } as TreeNode
  },
  skewed: {
    name: "Cây Lệch Trái (Left-Skewed)",
    desc: "Cây phát triển một phía tuyến tính (4 nút)",
    tree: {
      id: "s-1",
      value: "9",
      left: {
        id: "s-2",
        value: "2",
        left: {
          id: "s-3",
          value: "6",
          left: {
            id: "s-4",
            value: "10",
            left: null,
            right: null
          },
          right: null
        },
        right: null
      },
      right: null
    } as TreeNode
  }
};

// Depth limit to prevent UI messiness in dynamic building
const MAX_DEPTH_LIMIT = 4;

export default function App() {
  // Mode selection: 'lesson' (Prebuilt) or 'builder' (Interactive Custom Tree)
  const [appMode, setAppMode] = useState<'lesson' | 'builder'>('lesson');
  
  // Custom Tree Storage / Selection Mode state
  const [lessonTree, setLessonTree] = useState<TreeNode>(JSON.parse(JSON.stringify(ORIGINAL_PRESET_TREE)));
  const [customTree, setCustomTree] = useState<TreeNode>(() => {
    const saved = localStorage.getItem('binary_tree_editor_custom');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return JSON.parse(JSON.stringify(ORIGINAL_PRESET_TREE));
  });

  // Track currently active preset key
  const [activePreset, setActivePreset] = useState<'standard' | 'balanced' | 'skewed'>('standard');

  // Load a chosen preset into the active mode
  const handleLoadPreset = (key: 'standard' | 'balanced' | 'skewed') => {
    setActivePreset(key);
    const chosenTemplate = JSON.parse(JSON.stringify(TREE_PRESETS[key].tree));
    if (appMode === 'lesson') {
      setLessonTree(chosenTemplate);
    } else {
      saveCustomTree(chosenTemplate);
    }
    setSelectedNodeId(null);
    resetSimulation();
    showToast(`Đã nạp thành công: ${TREE_PRESETS[key].name}`, 'success');
  };

  // Current active tree based on mode
  const currentTree = useMemo(() => {
    return appMode === 'lesson' ? lessonTree : customTree;
  }, [appMode, lessonTree, customTree]);

  // Selected node on the SVG canvas for editing (builder mode)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Active algorithm type
  const [traversalType, setTraversalType] = useState<'LRN' | 'NRL' | 'RLN' | 'RNL' | 'NLR' | 'LNR'>('LRN');

  // Traversal execution simulation states
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // milliseconds

  // Educational terminology hover highlights
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Toast notifications for user guidance
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);

  // Node editing state form
  const [renameValue, setRenameValue] = useState<string>('');

  // Persist custom tree changes
  const saveCustomTree = (newTree: TreeNode) => {
    setCustomTree(newTree);
    localStorage.setItem('binary_tree_editor_custom', JSON.stringify(newTree));
  };

  // Toast timed trigger
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Show Toast helper
  const showToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  // Traversal execution sequence generated dynamically
  const traversalTrace = useMemo(() => {
    return getTraversalTrace(traversalType, currentTree);
  }, [traversalType, currentTree]);

  // Handle automatic stepping timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < traversalTrace.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            showToast("Duyệt cây hoàn thành! / Traversal completed!", "success");
            return prev;
          }
        });
      }, playbackSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, traversalTrace, playbackSpeed]);

  // Watch for tree mode and reset simulation when configuration changes
  useEffect(() => {
    resetSimulation();
  }, [traversalType, currentTree, appMode]);

  const resetSimulation = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const handleNextStep = () => {
    if (currentStep < traversalTrace.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Dynamic Traversal Solutions calculations for ANY tree configuration
  const dynamicSolutions = useMemo(() => {
    const getSolution = (type: string, root: TreeNode | null): string[] => {
      const res: string[] = [];
      if (!root) return res;
      
      function solve(n: TreeNode | null) {
        if (!n) return;
        
        const isN = (type === 'NLR' || type === 'NRL');
        const isLFirst = (type === 'LRN' || type === 'LNR');
        
        if (isN) res.push(n.value);
        
        if (isLFirst) {
          solve(n.left);
        } else {
          solve(n.right);
        }
        
        if (type === 'LNR') res.push(n.value);
        if (type === 'RNL') res.push(n.value);
        
        if (isLFirst) {
          solve(n.right);
        } else {
          solve(n.left);
        }
        
        if (type === 'LRN' || type === 'RLN') res.push(n.value);
      }
      
      solve(root);
      return res;
    };

    return {
      LRN: getSolution('LRN', currentTree),
      NRL: getSolution('NRL', currentTree),
      RLN: getSolution('RLN', currentTree),
      RNL: getSolution('RNL', currentTree),
      NLR: getSolution('NLR', currentTree),
      LNR: getSolution('LNR', currentTree),
    };
  }, [currentTree]);

  // Layout recursive positioning of Nodes
  const { nodes, lines, ghosts } = useMemo(() => {
    const layoutNodes: PositionedNode[] = [];
    const layoutLines: ConnectionLine[] = [];
    const layoutGhosts: Array<{ id: string; parentId: string; side: 'left' | 'right'; x: number; y: number; depth: number }> = [];

    // Height of levels & horizontal spacing math
    const startY = 45;
    const vSpace = 90;
    const initialHSpace = 185;

    function recLayout(
      node: TreeNode | null,
      cx: number,
      cy: number,
      hSpace: number,
      depth: number,
      parentId: string | null
    ) {
      if (!node) return;

      layoutNodes.push({
        id: node.id,
        value: node.value,
        x: cx,
        y: cy,
        depth,
        parentId,
        leftId: node.left ? node.left.id : null,
        rightId: node.right ? node.right.id : null,
      });

      const nextHSpace = hSpace * 0.49;

      // Handle Left Child or Dotted Ghost in builder
      if (node.left) {
        layoutLines.push({
          id: `line-${node.id}-${node.left.id}`,
          x1: cx,
          y1: cy,
          x2: cx - hSpace,
          y2: cy + vSpace,
          parentId: node.id,
          childId: node.left.id,
          side: 'left',
        });
        recLayout(node.left, cx - hSpace, cy + vSpace, nextHSpace, depth + 1, node.id);
      } else if (appMode === 'builder' && depth < MAX_DEPTH_LIMIT) {
        layoutGhosts.push({
          id: `ghost-${node.id}-left`,
          parentId: node.id,
          side: 'left',
          x: cx - hSpace,
          y: cy + vSpace,
          depth: depth + 1,
        });
      }

      // Handle Right Child or Dotted Ghost in builder
      if (node.right) {
        layoutLines.push({
          id: `line-${node.id}-${node.right.id}`,
          x1: cx,
          y1: cy,
          x2: cx + hSpace,
          y2: cy + vSpace,
          parentId: node.id,
          childId: node.right.id,
          side: 'right',
        });
        recLayout(node.right, cx + hSpace, cy + vSpace, nextHSpace, depth + 1, node.id);
      } else if (appMode === 'builder' && depth < MAX_DEPTH_LIMIT) {
        layoutGhosts.push({
          id: `ghost-${node.id}-right`,
          parentId: node.id,
          side: 'right',
          x: cx + hSpace,
          y: cy + vSpace,
          depth: depth + 1,
        });
      }
    }

    recLayout(currentTree, 400, startY, initialHSpace, 0, null);

    return { nodes: layoutNodes, lines: layoutLines, ghosts: layoutGhosts };
  }, [currentTree, appMode]);

  // Auto update input text when selected node shifts
  useEffect(() => {
    if (selectedNodeId) {
      const nodeObj = findNodeById(currentTree, selectedNodeId);
      if (nodeObj) {
        setRenameValue(nodeObj.value);
      }
    }
  }, [selectedNodeId, currentTree]);

  // Find node by id
  function findNodeById(root: TreeNode | null, id: string): TreeNode | null {
    if (!root) return null;
    if (root.id === id) return root;
    const l = findNodeById(root.left, id);
    if (l) return l;
    return findNodeById(root.right, id);
  }

  // Set visual focus of custom educational highlights
  const isEduHighlighted = (nodeId: string, nodeVal: string) => {
    if (!hoveredTerm) return false;
    
    // Find matching node inside nodes
    const details = nodes.find(n => n.id === nodeId);
    if (!details) return false;

    switch (hoveredTerm) {
      case 'root':
        return details.parentId === null;
      case 'leaf':
        return details.leftId === null && details.rightId === null;
      case 'internal':
        return details.parentId !== null && (details.leftId !== null || details.rightId !== null);
      case 'left-subtree': {
        const rootNode = currentTree;
        if (!rootNode || !rootNode.left) return false;
        return findNodeById(rootNode.left, nodeId) !== null;
      }
      case 'right-subtree': {
        const rootNode = currentTree;
        if (!rootNode || !rootNode.right) return false;
        return findNodeById(rootNode.right, nodeId) !== null;
      }
      default:
        return false;
    }
  };

  // Traversal status properties
  const activeEvent: TraversalEvent | undefined = traversalTrace[currentStep];
  const activeNodeId = activeEvent?.nodeId || null;
  const resultSequence = activeEvent?.resultAcquired || [];

  // Identify whether a connection is being processed right now in the step animation
  const isLineHighlighted = (parentId: string, childId: string) => {
    if (!activeEvent) return false;
    
    // Line is highlighted if:
    // 1. Enter state moving from parent to child
    if (activeEvent.type === 'left' || activeEvent.type === 'right') {
      const targetChildId = activeEvent.type === 'left' 
        ? nodes.find(n => n.id === parentId)?.leftId 
        : nodes.find(n => n.id === parentId)?.rightId;
      return parentId === activeEvent.nodeId && targetChildId === childId;
    }
    // 2. Or if active node is this child, and we entered or backtracked
    if (activeNodeId === childId && (activeEvent.type === 'enter' || activeEvent.type === 'visit')) {
      return true;
    }
    return false;
  };

  // Custom node builder action handlers
  const handleAddNewNode = (parentId: string, side: 'left' | 'right') => {
    // Generate fresh unique values
    const generatedVal = getNextAvailableLabel(currentTree);
    const newId = `node-${Date.now()}`;
    const newTree = insertChild(currentTree, parentId, side, newId, generatedVal);
    saveCustomTree(newTree);
    setSelectedNodeId(newId);
    showToast(`Đã thêm nút mới [${generatedVal}] vào bên ${side === 'left' ? 'Trái' : 'Phải'}`, 'success');
  };

  const handleRenameNode = (newValue: string) => {
    if (!selectedNodeId) return;
    if (!newValue.trim()) {
      showToast("Tên nút không được rỗng / Node label cannot be empty!", "warning");
      return;
    }
    const filteredText = newValue.trim().substring(0, 4); // Keep short
    const updatedTree = renameNode(currentTree, selectedNodeId, filteredText);
    saveCustomTree(updatedTree);
    showToast(`Đã cập nhật nhãn nút thành "${filteredText}"`, "success");
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === currentTree.id) {
      showToast("Không thể xóa nút gốc chính! / Cannot delete root node!", "warning");
      return;
    }
    const updatedTree = deleteNode(currentTree, nodeId);
    if (updatedTree) {
      saveCustomTree(updatedTree);
      setSelectedNodeId(null);
      showToast("Đã xóa nút và toàn bộ cây con liên quan", "info");
    }
  };

  const handleResetCustomTreeToOriginal = () => {
    const fresh = JSON.parse(JSON.stringify(ORIGINAL_PRESET_TREE));
    saveCustomTree(fresh);
    setSelectedNodeId(null);
    setActivePreset('standard');
    showToast("Đã khôi phục cây về mẫu ban đầu của bài học", "success");
  };

  const handleClearToSoleRoot = () => {
    const singleRoot: TreeNode = {
      id: "node-root-sole",
      value: "9",
      left: null,
      right: null
    };
    saveCustomTree(singleRoot);
    setSelectedNodeId("node-root-sole");
    showToast("Đã đưa cây về một nút gốc duy nhất", "info");
  };

  // Traversal trace generation helpers
  function getTraversalTrace(type: string, root: TreeNode | null): TraversalEvent[] {
    const events: TraversalEvent[] = [];
    const result: string[] = [];
    if (!root) return events;

    // Helper functions for traversals
    function traceLRN_rec(node: TreeNode | null) {
      if (!node) return;
      events.push({
        type: 'enter',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Evaluating [Node ${node.value}]. Post-order checks Left branches first.`,
        messageVi: `Xét nút [${node.value}]. Quy chuẩn LRN ưu tiên duyệt toàn bộ nhánh Trái trước.`,
        resultAcquired: [...result],
      });

      if (node.left) {
        events.push({
          type: 'left',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Go to left child [Node ${node.left.value}].`,
          messageVi: `Từ nút [${node.value}], di chuyển xuống nút con bên Trái là [${node.left.value}].`,
          resultAcquired: [...result],
        });
        traceLRN_rec(node.left);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to parent [Node ${node.value}] from left child.`,
          messageVi: `Nhánh Trái đã duyệt xong, quay về nút cha [${node.value}]. Chuyển sang xử lý nhánh Phải.`,
          resultAcquired: [...result],
        });
      }

      if (node.right) {
        events.push({
          type: 'right',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Go to right child [Node ${node.right.value}].`,
          messageVi: `Từ nút [${node.value}], di chuyển xuống nút con bên Phải là [${node.right.value}].`,
          resultAcquired: [...result],
        });
        traceLRN_rec(node.right);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to parent [Node ${node.value}] from right child.`,
          messageVi: `Nhánh Phải đã duyệt xong, quay về nút cha [${node.value}]. Cả hai nhánh con đã được duyệt.`,
          resultAcquired: [...result],
        });
      }

      result.push(node.value);
      events.push({
        type: 'visit',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Both subtrees evaluated. Visit and record Node value [${node.value}].`,
        messageVi: `Hoàn tất cả hai nhánh Trái & Phải. Thực hiện đọc & ghi nhận nút [${node.value}] vào kết quả.`,
        resultAcquired: [...result],
      });
    }

    function traceNRL_rec(node: TreeNode | null) {
      if (!node) return;

      result.push(node.value);
      events.push({
        type: 'visit',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `NRL: Record Node [${node.value}] immediately. Preparing to visit Right subtree.`,
        messageVi: `NRL: Ghi nhận nút gốc [${node.value}] ngay lúc này. Tiếp theo sẽ đi xuống nhánh bên Phải.`,
        resultAcquired: [...result],
      });

      if (node.right) {
        events.push({
          type: 'right',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Go to Right child [Node ${node.right.value}].`,
          messageVi: `Từ nút [${node.value}], dịch chuyển xuống nút con bên Phải là [${node.right.value}].`,
          resultAcquired: [...result],
        });
        traceNRL_rec(node.right);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Back up to parent [Node ${node.value}] from Right.`,
          messageVi: `Duyệt xong nhánh Phải, quay ngược trở về nút cha [${node.value}]. Chuẩn bị duyệt tiếp nhánh Trái.`,
          resultAcquired: [...result],
        });
      }

      if (node.left) {
        events.push({
          type: 'left',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Go to Left child [Node ${node.left.value}].`,
          messageVi: `Từ nút [${node.value}], rẽ xuống nút con bên Trái là [${node.left.value}].`,
          resultAcquired: [...result],
        });
        traceNRL_rec(node.left);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Back up to parent [Node ${node.value}] from Left.`,
          messageVi: `Duyệt xong nhánh Trái, quay ngược về nút [${node.value}]. Toàn bộ các nhánh con đã hoàn thành.`,
          resultAcquired: [...result],
        });
      }
    }

    function traceRLN_rec(node: TreeNode | null) {
      if (!node) return;

      events.push({
        type: 'enter',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Examining [Node ${node.value}]. RLN requires evaluating the Right subtree completely first.`,
        messageVi: `Xét nút [${node.value}]. Thứ tự RLN bắt buộc hoàn tất nhánh bên Phải trước tiên.`,
        resultAcquired: [...result],
      });

      if (node.right) {
        events.push({
          type: 'right',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Go to Right child [Node ${node.right.value}].`,
          messageVi: `Từ nút [${node.value}], đi xuống nhánh con bên Phải là [${node.right.value}].`,
          resultAcquired: [...result],
        });
        traceRLN_rec(node.right);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Back up to parent [Node ${node.value}] from Right.`,
          messageVi: `Duyệt nhánh Phải kết thúc, quay về nút [${node.value}]. Chuyển tiếp đi xuống nhánh Trái.`,
          resultAcquired: [...result],
        });
      }

      if (node.left) {
        events.push({
          type: 'left',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Go to Left child [Node ${node.left.value}].`,
          messageVi: `Từ nút [${node.value}], rẽ sang nút con bên Trái là [${node.left.value}].`,
          resultAcquired: [...result],
        });
        traceRLN_rec(node.left);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Back up to parent [Node ${node.value}] from Left.`,
          messageVi: `Nhánh Trái hoàn thành, quay về [${node.value}]. Cả hai nhánh Phải & Trái đã duyệt xong.`,
          resultAcquired: [...result],
        });
      }

      result.push(node.value);
      events.push({
        type: 'visit',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Both subtrees complete. Record Node [${node.value}] to output.`,
        messageVi: `Phải và Trái đã duyệt xong. Ta tiến hành ghi nhận nút gốc [${node.value}] vào kết quả.`,
        resultAcquired: [...result],
      });
    }

    // Right, Node, Left
    function traceRNL_rec(node: TreeNode | null) {
      if (!node) return;

      events.push({
        type: 'enter',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Examining [Node ${node.value}]. RNL starts with Right subtree.`,
        messageVi: `Xét nút [${node.value}]. Sơ đồ RNL bắt đầu tiến hành kiểm tra cây con Phải trước.`,
        resultAcquired: [...result],
      });

      if (node.right) {
        events.push({
          type: 'right',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Explore Right child [Node ${node.right.value}].`,
          messageVi: `Từ [${node.value}], di chuyển xuống nhánh con bên Phải là [${node.right.value}].`,
          resultAcquired: [...result],
        });
        traceRNL_rec(node.right);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to parent [Node ${node.value}] from Right.`,
          messageVi: `Nhánh Phải hoàn thành, quay lại [${node.value}]. Gốc lúc này được ghi nhận.`,
          resultAcquired: [...result],
        });
      }

      result.push(node.value);
      events.push({
        type: 'visit',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Visit and record Node [${node.value}]. Next, visit Left child.`,
        messageVi: `Ghi nhận giá trị nút [${node.value}]. Tiếp theo hệ thống di chuyển sang nhánh con Trái.`,
        resultAcquired: [...result],
      });

      if (node.left) {
        events.push({
          type: 'left',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Explore Left child [Node ${node.left.value}].`,
          messageVi: `Từ [${node.value}], rẽ xuống nhánh con bên Trái là [${node.left.value}].`,
          resultAcquired: [...result],
        });
        traceRNL_rec(node.left);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to parent [Node ${node.value}] from Left.`,
          messageVi: `Cây con bên Trái hoàn tất, quay ngược lên nút cha [${node.value}]. Tất cả nhánh đã hoàn thành.`,
          resultAcquired: [...result],
        });
      }
    }

    function traceNLR_rec(node: TreeNode | null) {
      if (!node) return;

      result.push(node.value);
      events.push({
        type: 'visit',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `NLR: Record Node [${node.value}] (Gốc) first, then proceed to Left child.`,
        messageVi: `NLR: Ghi nhận Gốc [${node.value}] lập tức. Tiếp theo rẽ xuống nhánh con Trái.`,
        resultAcquired: [...result],
      });

      if (node.left) {
        events.push({
          type: 'left',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Explore Left child [Node ${node.left.value}].`,
          messageVi: `Từ nút [${node.value}], di chuyển xuống nhánh con Trái [${node.left.value}].`,
          resultAcquired: [...result],
        });
        traceNLR_rec(node.left);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to [Node ${node.value}] from Left.`,
          messageVi: `Cây con Trái xong, quay lại nút [${node.value}]. Chuẩn bị rẽ sang bên Phải.`,
          resultAcquired: [...result],
        });
      }

      if (node.right) {
        events.push({
          type: 'right',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Explore Right child [Node ${node.right.value}].`,
          messageVi: `Từ nút [${node.value}], di chuyển xuống nhánh con Phải [${node.right.value}].`,
          resultAcquired: [...result],
        });
        traceNLR_rec(node.right);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to [Node ${node.value}] from Right.`,
          messageVi: `Cây con Phải xong, quay về nút [${node.value}]. Hoàn tất cả hai nhánh con.`,
          resultAcquired: [...result],
        });
      }
    }

    function traceLNR_rec(node: TreeNode | null) {
      if (!node) return;

      events.push({
        type: 'enter',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Examining [Node ${node.value}]. LNR must process Left subtree fully first.`,
        messageVi: `Xét nút [${node.value}]. Thứ tự LNR yêu cầu hoàn tất toàn bộ cây con bên Trái trước.`,
        resultAcquired: [...result],
      });

      if (node.left) {
        events.push({
          type: 'left',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Explore Left child [Node ${node.left.value}].`,
          messageVi: `Từ nút [${node.value}], rẽ sang nút con bên Trái là [${node.left.value}].`,
          resultAcquired: [...result],
        });
        traceLNR_rec(node.left);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to parent [Node ${node.value}] from Left. Node will be read immediately.`,
          messageVi: `Cây con Trái đã duyệt xong, quay về [${node.value}]. Tiến hành đọc ghi nhận nút Gốc.`,
          resultAcquired: [...result],
        });
      }

      result.push(node.value);
      events.push({
        type: 'visit',
        nodeId: node.id,
        nodeValue: node.value,
        messageEn: `Visit and output Node [${node.value}] now. Proceeding to explore Right subtree.`,
        messageVi: `Ghi nhận nút Gốc [${node.value}] vào kết quả. Tiếp theo rẽ xuống cây con bên Phải.`,
        resultAcquired: [...result],
      });

      if (node.right) {
        events.push({
          type: 'right',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Explore Right child [Node ${node.right.value}].`,
          messageVi: `Từ nút [${node.value}], rẽ xuống nút con bên Phải là [${node.right.value}].`,
          resultAcquired: [...result],
        });
        traceLNR_rec(node.right);
        events.push({
          type: 'backtrack',
          nodeId: node.id,
          nodeValue: node.value,
          messageEn: `Backtrack to parent [Node ${node.value}] from Right.`,
          messageVi: `Cây con bên Phải đã duyệt xong, quay trở lại nút cha [${node.value}]. Hoàn tất tất cả.`,
          resultAcquired: [...result],
        });
      }
    }

    // Call chosen traversal
    switch (type) {
      case 'LRN': traceLRN_rec(root); break;
      case 'NRL': traceNRL_rec(root); break;
      case 'RLN': traceRLN_rec(root); break;
      case 'RNL': traceRNL_rec(root); break;
      case 'NLR': traceNLR_rec(root); break;
      case 'LNR': traceLNR_rec(root); break;
      default: break;
    }
    return events;
  }

  // Get next logical letter or integer for newly created nodes
  function getNextAvailableLabel(tree: TreeNode): string {
    const vals = new Set<string>();
    function collect(n: TreeNode | null) {
      if (!n) return;
      vals.add(n.value);
      collect(n.left);
      collect(n.right);
    }
    collect(tree);

    let candidate = 1;
    while (vals.has(String(candidate))) {
      candidate++;
    }
    return String(candidate);
  }

  // Pure dynamic tree updater functions
  function insertChild(
    root: TreeNode,
    parentId: string,
    side: 'left' | 'right',
    newId: string,
    newValue: string
  ): TreeNode {
    const insertRecursive = (node: TreeNode): TreeNode => {
      if (node.id === parentId) {
        const newNode: TreeNode = { id: newId, value: newValue, left: null, right: null };
        if (side === 'left') {
          return { ...node, left: newNode };
        } else {
          return { ...node, right: newNode };
        }
      }
      return {
        ...node,
        left: node.left ? insertRecursive(node.left) : null,
        right: node.right ? insertRecursive(node.right) : null,
      };
    };
    return insertRecursive(root);
  }

  function renameNode(root: TreeNode, targetId: string, newValue: string): TreeNode {
    const renameRecursive = (node: TreeNode): TreeNode => {
      if (node.id === targetId) {
        return { ...node, value: newValue };
      }
      return {
        ...node,
        left: node.left ? renameRecursive(node.left) : null,
        right: node.right ? renameRecursive(node.right) : null,
      };
    };
    return renameRecursive(root);
  }

  function deleteNode(root: TreeNode, targetId: string): TreeNode | null {
    if (root.id === targetId) return null; // Root delete safety handled at root level

    const deleteRecursive = (node: TreeNode): TreeNode => {
      return {
        ...node,
        left: node.left ? (node.left.id === targetId ? null : deleteRecursive(node.left)) : null,
        right: node.right ? (node.right.id === targetId ? null : deleteRecursive(node.right)) : null,
      };
    };
    return deleteRecursive(root);
  }

  // Validate if current customized result matches the correct answer trace dynamically
  const isCustomResultCorrect = useMemo(() => {
    try {
      const expected = dynamicSolutions[traversalType];
      const actual = resultSequence;
      if (actual.length !== expected.length) return false;
      return expected.every((v, i) => actual[i] === v);
    } catch (e) {
      return false;
    }
  }, [traversalType, resultSequence, dynamicSolutions]);

  // Selected Node Details
  const selectedNodeDetails = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Toast Notification Bar */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border bg-white border-slate-200 animate-bounce duration-500">
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          ) : toast.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-500" />
          ) : (
            <Info className="w-5 h-5 text-blue-500" />
          )}
          <span className="text-sm font-semibold text-slate-700">{toast.message}</span>
        </div>
      )}

      {/* Hero Header bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-md shadow-emerald-200">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-850 flex items-center gap-2">
              Bộ Học Tập Duyệt Cây Nhị Phân 
              <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                Studio Trực Quan
              </span>
            </h1>
            <p className="text-xs text-slate-500 tracking-wide mt-0.5">Duyệt cây thông minh & Xây dựng trực quan qua LRN, NRL, RLN, RNL, NLR, LNR</p>
          </div>
        </div>

        {/* Big Switch Tab for Lesson vs custom builder */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner shrink-0">
          <button
            id="tab-lesson"
            onClick={() => {
              setAppMode('lesson');
              setSelectedNodeId(null);
              resetSimulation();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
              appMode === 'lesson' 
                ? 'bg-white text-slate-950 shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bài Học Cố Định (Lesson Table)</span>
          </button>
          <button
            id="tab-builder"
            onClick={() => {
              setAppMode('builder');
              setSelectedNodeId(null);
              resetSimulation();
              // Synchronize builder state to storage
              saveCustomTree(customTree);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
              appMode === 'builder' 
                ? 'bg-white text-slate-950 shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-blue-650" />
            <span>Tự Thiết Kế Cây (Tree Builder)</span>
          </button>
        </div>
      </header>

      {/* Preset Tree Templates Selection in Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 shrink-0">
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          Mẫu cây cấu trúc có sẵn:
        </span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TREE_PRESETS) as Array<keyof typeof TREE_PRESETS>).map((key) => {
            const isSelected = activePreset === key;
            return (
              <button
                key={key}
                onClick={() => handleLoadPreset(key)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer border ${
                  isSelected 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-2xs' 
                    : 'bg-slate-50 text-slate-650 border-slate-200/80 hover:bg-slate-100'
                }`}
                title={TREE_PRESETS[key].desc}
              >
                {TREE_PRESETS[key].name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Educational Workspace */}
      <main className="max-w-[1500px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMN 1: Visual Tree Drawer Canvas (Take up 7-8 columns out of 12) */}
        <section className="col-span-1 lg:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-200/85 shadow-sm overflow-hidden min-h-[500px]">
          
          <div className="p-4 bg-slate-50/70 border-b border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-bold text-slate-700 text-sm">
                Đồ Họa Trực Quan ({appMode === 'lesson' ? 'Căn Bản Bài Học' : 'Thiết Kế Tùy Biến'})
              </h2>
            </div>

            {/* Builder layout extra controls */}
            {appMode === 'builder' && (
              <div className="flex gap-2">
                <button
                  id="btn-clear"
                  onClick={handleClearToSoleRoot}
                  className="bg-slate-200/80 hover:bg-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg text-slate-800 transition-colors cursor-pointer"
                >
                  Xóa Hết (Nút Gốc Sole)
                </button>
                <button
                  id="btn-restore"
                  onClick={handleResetCustomTreeToOriginal}
                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Thiết Lập Lại (Reset)
                </button>
              </div>
            )}
          </div>

          {/* Canvas SVG frame */}
          <div className="relative flex-1 bg-white flex items-center justify-center p-4 overflow-hidden select-none">
            
            {/* Guide overlay */}
            <div className="absolute top-3 left-4 bg-white/80 backdrop-blur-md p-3 rounded-xl text-[11px] text-slate-500 border border-slate-150 pointer-events-none z-10 space-y-1 shadow-xs">
              <p className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5 text-slate-400" /> Nhấp vào nút để chọn và sửa</p>
              <p className="flex items-center gap-1">🟢 Vòng hào quang hiển thị bước duyệt hiện tại</p>
              {appMode === 'builder' && <p className="text-blue-600 font-bold flex items-center gap-1">➕ Nhấp dấu cộng (+) mờ trên nhánh để thêm con</p>}
            </div>

            <div className="w-full max-w-[85 w-full] aspect-[800/480] relative">
              <svg 
                className="w-full h-full"
                viewBox="0 0 800 480"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Definition for elegant SVG arrow markers */}
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="28"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
                  </marker>
                  
                  <marker
                    id="arrow-active"
                    viewBox="0 0 10 10"
                    refX="28"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
                  </marker>

                  {/* Gradient for links */}
                  <linearGradient id="link-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#cbd5e1" />
                    <stop offset="100%" stopColor="#94a3b8" />
                  </linearGradient>

                  <linearGradient id="link-grad-active" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>

                  {/* Soft glow filters */}
                  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#059669" floodOpacity="0.5" />
                  </filter>
                  <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.6" />
                  </filter>
                  <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#3b82f6" floodOpacity="0.5" />
                  </filter>
                </defs>

                {/* Draw connection lines recursively calculated */}
                {lines.map((line) => {
                  const active = isLineHighlighted(line.parentId, line.childId);
                  return (
                    <g key={line.id}>
                      {/* Glow background representing signal */}
                      <path
                        d={`M ${line.x1} ${line.y1} C ${line.x1} ${(line.y1 + line.y2) / 2}, ${line.x2} ${(line.y1 + line.y2) / 2}, ${line.x2} ${line.y2}`}
                        stroke={active ? '#10b981' : '#f1f5f9'}
                        strokeWidth={active ? 8 : 4}
                        strokeLinecap="round"
                        className="transition-all duration-300 opacity-25"
                      />
                      {/* Primary functional line path */}
                      <path
                        id={`p-${line.id}`}
                        d={`M ${line.x1} ${line.y1} C ${line.x1} ${(line.y1 + line.y2) / 2}, ${line.x2} ${(line.y1 + line.y2) / 2}, ${line.x2} ${line.y2}`}
                        stroke={active ? 'url(#link-grad-active)' : 'url(#link-grad)'}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        fill="none"
                        className="transition-all duration-300"
                        markerEnd={active ? "url(#arrow-active)" : "url(#arrow)"}
                      />
                    </g>
                  );
                })}

                {/* Draw sliding visual messenger dots representing active traversing flow */}
                {lines.map((line) => {
                  const active = isLineHighlighted(line.parentId, line.childId);
                  if (!active) return null;
                  return (
                    <circle key={`runner-${line.id}`} r="4" fill="#059669">
                      <animateMotion 
                        path={`M ${line.x1} ${line.y1} C ${line.x1} ${(line.y1 + line.y2) / 2}, ${line.x2} ${(line.y1 + line.y2) / 2}, ${line.x2} ${line.y2}`}
                        dur={`${Math.max(playbackSpeed * 0.8, 300)}ms`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  );
                })}

                {/* Draw Dynamic ghost add slots if builder mode is open */}
                {ghosts.map((ghost) => (
                  <g 
                    key={ghost.id} 
                    className="cursor-pointer group select-none opacity-45 hover:opacity-100 transition-all duration-200"
                    onClick={() => handleAddNewNode(ghost.parentId, ghost.side)}
                  >
                    {/* Ghost node dotted circle */}
                    <circle
                      cx={ghost.x}
                      cy={ghost.y}
                      r="16.5"
                      fill="#eff6ff"
                      stroke="#bfdbfe"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    {/* Add plus character inside dot */}
                    <text
                      x={ghost.x}
                      y={ghost.y + 4}
                      textAnchor="middle"
                      fill="#2563eb"
                      className="text-[13px] font-bold"
                    >
                      +
                    </text>
                  </g>
                ))}

                {/* Draw Actual Tree Nodes with premium hover rings and status glows */}
                {nodes.map((node) => {
                  const nodeValueStr = String(node.value);
                  const isSelected = selectedNodeId === node.id;
                  const isActive = activeNodeId === node.id;
                  const isEduActive = isEduHighlighted(node.id, nodeValueStr);
                  
                  // Track sequence index in the resulting walk output
                  const isVisited = resultSequence.includes(nodeValueStr);
                  const visitIndex = resultSequence.indexOf(nodeValueStr);

                  // Colors and sizes based on status to prevent jumping bugs!
                  let circleFill = '#ffffff';
                  let circleStroke = '#cbd5e1';
                  let textCol = '#334155';
                  let radius = 19.5;

                  if (isActive) {
                    circleFill = '#059669'; // High emerald focus
                    circleStroke = '#10b981';
                    textCol = '#ffffff';
                    radius = 23; // Larger for visual priority
                  } else if (isVisited) {
                    circleFill = '#e6fcf5'; // Light green tint
                    circleStroke = '#10b981';
                    textCol = '#0f5132';
                    radius = 21;
                  }

                  if (isSelected) {
                    circleStroke = '#f59e0b'; // Amber focus
                    radius = Math.max(radius, 22.5);
                  }

                  if (isEduActive) {
                    circleStroke = '#3b82f6'; // Bright ocean blue highlights
                    radius = Math.max(radius, 22);
                  }

                  return (
                    <g 
                      key={node.id} 
                      className="cursor-pointer transition-transform duration-300"
                      id={`node-circle-${node.id}`}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      {/* Selection Glow rings backdrops */}
                      {isSelected && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={radius + 6.5}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          strokeOpacity={0.5}
                          strokeDasharray="3 2"
                        />
                      )}

                      {/* Classroom Terms Highlights */}
                      {isEduActive && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={radius + 5}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          strokeOpacity={0.8}
                          className="animate-pulse"
                        />
                      )}

                      {/* Active Pulse visual backdrop */}
                      {isActive && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={radius + 4}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          className="animate-ping opacity-50"
                        />
                      )}

                      {/* Main Node body circular frame */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius}
                        fill={circleFill}
                        stroke={circleStroke}
                        strokeWidth={isSelected ? 3.5 : isActive ? 3 : 2.5}
                        filter={isActive ? "url(#glow)" : isSelected ? "url(#glow-gold)" : isEduActive ? "url(#glow-blue)" : undefined}
                      />

                      {/* Node Text Content Label */}
                      <text
                        x={node.x}
                        y={node.y + 4.5}
                        textAnchor="middle"
                        fill={textCol}
                        className="text-[12.5px] font-extrabold tracking-tight text-center"
                      >
                        {nodeValueStr}
                      </text>

                      {/* Visit Index Notification badge (e.g. "①") */}
                      {isVisited && !isActive && (
                        <g transform={`translate(${node.x + 13}, ${node.y - 13})`}>
                          <circle r="7.5" fill="#10b981" />
                          <text 
                            y="2.5" 
                            textAnchor="middle" 
                            fill="#ffffff" 
                            className="text-[9px] font-black"
                          >
                            {visitIndex + 1}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* DYNAMIC TIMELINE VISUALIZER OF EXECUTION STEPS */}
          <div className="bg-slate-50 border-t border-slate-100 p-4 select-none">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span>🎛️ Dòng thời gian từng bước</span>
              <span className="text-[10px] font-normal lowercase text-slate-400 font-sans italic">(Nhấp vào bước bất kỳ để nhảy trực tiếp tới đồ họa)</span>
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {traversalTrace.map((evt, idx) => {
                const isCurrent = currentStep === idx;
                const isPassed = idx < currentStep;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`shrink-0 flex flex-col items-center p-2 rounded-xl border text-center transition-all min-w-[85px] cursor-pointer ${
                      isCurrent 
                        ? 'bg-emerald-600 border-emerald-600 text-white font-bold scale-105 shadow-md shadow-emerald-100'
                        : isPassed
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-mono tracking-wider opacity-65">Bước {idx + 1}</span>
                    <span className="text-xs font-mono font-black my-0.5">{evt.nodeValue}</span>
                    <span className="text-[8px] font-bold uppercase opacity-80">{evt.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TRAVERSAL CONTROL & PLAYBACK SLIDER */}
          <div className="p-4 bg-slate-100/70 border-t border-slate-200/50 flex flex-col md:flex-row gap-4 justify-between items-center select-none">
            
            {/* Step tracker text */}
            <div className="flex flex-col gap-0.5 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trình Duyệt Bước / Playback</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-md">
                  {currentStep + 1} / {traversalTrace.length || 1}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Điều động vị trí quét của thuật toán</p>
            </div>

            {/* Main playback control cluster button bar */}
            <div className="flex items-center gap-2">
              <button
                id="btn-prev"
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                title="Quay lại bước trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                id="btn-play-pause"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={traversalTrace.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-md transition-all cursor-pointer ${
                  isPlaying 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-white" />
                    <span className="text-xs uppercase">Tạm Dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span className="text-xs uppercase">
                      {currentStep === traversalTrace.length - 1 ? 'Chạy Lại' : 'Tự Động'}
                    </span>
                  </>
                )}
              </button>

              <button
                id="btn-next"
                onClick={handleNextStep}
                disabled={currentStep === traversalTrace.length - 1 || traversalTrace.length === 0}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
                title="Bước tiếp theo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                id="btn-reset"
                onClick={resetSimulation}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                title="Khởi động lại tiến trình"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Playback Interval Speed adjustment */}
            <div className="flex items-center gap-3 w-full md:w-[240px]">
              <span className="text-xs font-bold text-slate-500 shrink-0">Độ trễ:</span>
              <input
                id="playback-speed-slider"
                type="range"
                min="200"
                max="2500"
                step="150"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="flex-1 accent-emerald-650 h-1 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono font-bold text-slate-400 w-12 text-right">
                {playbackSpeed}ms
              </span>
            </div>
          </div>
        </section>

        {/* COLUMN 2: Workspace controls & Active Node Inspector */}
        <section className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          
          {/* SELECT THE TRAVERSAL PATTERN CARDS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-150 pb-3">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Chọn Phép Duyệt Cây / Traversal
              </h3>
            </div>

            {/* 4 Core Traversals requested by the user */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-traversal-LRN"
                onClick={() => setTraversalType('LRN')}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  traversalType === 'LRN'
                    ? 'border-emerald-500 bg-emerald-55/70 text-emerald-950 font-bold shadow-2xs bg-emerald-50'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-mono font-black">1. LRN</span>
                  <span className="text-[8px] bg-slate-200 text-slate-550 font-extrabold rounded px-1">Post-order</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500">Trái → Phải → Gốc</p>
              </button>

              <button
                id="btn-traversal-NRL"
                onClick={() => setTraversalType('NRL')}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  traversalType === 'NRL'
                    ? 'border-emerald-500 bg-emerald-55/70 text-emerald-950 font-bold shadow-2xs bg-emerald-50'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-mono font-black">2. NRL</span>
                  <span className="text-[8px] bg-slate-200 text-slate-550 font-extrabold rounded px-1">Rev-Pre</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500">Gốc → Phải → Trái</p>
              </button>

              <button
                id="btn-traversal-RLN"
                onClick={() => setTraversalType('RLN')}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  traversalType === 'RLN'
                    ? 'border-emerald-500 bg-emerald-55/70 text-emerald-950 font-bold shadow-2xs bg-emerald-50'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-mono font-black">3. RLN</span>
                  <span className="text-[8px] bg-slate-200 text-slate-550 font-extrabold rounded px-1">Rev-Post</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500">Phải → Trái → Gốc</p>
              </button>

              <button
                id="btn-traversal-RNL"
                onClick={() => setTraversalType('RNL')}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  traversalType === 'RNL'
                    ? 'border-emerald-500 bg-emerald-55/70 text-emerald-950 font-bold shadow-2xs bg-emerald-50'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-mono font-black">4. RNL</span>
                  <span className="text-[8px] bg-slate-200 text-slate-550 font-extrabold rounded px-1">Rev-In</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500">Phải → Gốc → Trái</p>
              </button>
            </div>

            {/* Extra standards traversals */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Thuật toán tiêu chuẩn kinh điển</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-traversal-NLR"
                  onClick={() => setTraversalType('NLR')}
                  className={`px-3 py-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    traversalType === 'NLR'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-550'
                  }`}
                >
                  <span className="font-extrabold text-[11px] block">NLR (Pre-order)</span>
                  <span className="text-[10px] text-slate-400">Gốc → Trái → Phải</span>
                </button>

                <button
                  id="btn-traversal-LNR"
                  onClick={() => setTraversalType('LNR')}
                  className={`px-3 py-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    traversalType === 'LNR'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-550'
                  }`}
                >
                  <span className="font-extrabold text-[11px] block">LNR (In-order)</span>
                  <span className="text-[10px] text-slate-400">Trái → Gốc → Phải</span>
                </button>
              </div>
            </div>
          </div>

          {/* ACTIVE STEP CONSOLE EXPLAIN PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Chi Tiết Thực Thi Hiện Tại
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
                  {activeEvent?.type?.toUpperCase() || 'SẴN SÀNG'}
                </span>
              </div>

              {/* Steps Bilingual Explanations Cards */}
              {activeEvent ? (
                <div className="space-y-3.5">
                  {/* Vietnamese card section */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Giải thích Tiếng Việt:
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed font-semibold">
                      {activeEvent.messageVi}
                    </p>
                  </div>

                  {/* English Translation */}
                  <div className="bg-white rounded-xl p-3 border border-slate-150 border-dashed">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-350" />
                      English Reference:
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                      {activeEvent.messageEn}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 flex flex-col items-center justify-center gap-2">
                  <HelpCircle className="w-10 h-10 text-slate-300 animate-bounce duration-1000" />
                  <p className="text-xs font-bold">Bấm "Tự Động" hoặc các mũi tên để xem diễn giải từng bước!</p>
                  <p className="text-[10px]">Playback moves will showcase the recursive trace here.</p>
                </div>
              )}
            </div>

            {/* Summary results compiled lists */}
            <div className="pt-3 border-t border-slate-150/70 space-y-2">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                Kết Quả Đầu Ra (Output Buffer):
              </span>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-900 text-white min-h-[44px] items-center border border-slate-800 shadow-inner">
                {resultSequence.length === 0 ? (
                  <span className="text-xs text-slate-500 italic font-mono pl-1">Đang chờ bước duyệt đầu tiên...</span>
                ) : (
                  resultSequence.map((val, idx) => (
                    <span 
                      key={`${val}-${idx}`} 
                      className="px-2 py-1 rounded bg-emerald-600 text-white font-extrabold text-xs font-mono shadow-xs flex items-center gap-1 border border-emerald-500/35"
                    >
                      <span className="opacity-55 text-[9px]">{idx + 1}:</span>
                      {val}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE NODE INSPECTOR / BUILDER CONTROLS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Thanh Quản Lý Nút: {selectedNodeDetails ? `Nút [${selectedNodeDetails.value}]` : 'Chưa Chọn Nút'}
                </h3>
              </div>
              {selectedNodeId && appMode === 'builder' && (
                <button
                  id="btn-delete-active"
                  onClick={() => handleDeleteNode(selectedNodeId)}
                  disabled={selectedNodeId === currentTree.id}
                  className="flex items-center gap-1 text-[10px] bg-red-50 text-red-700 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-100 disabled:opacity-45 transition-colors cursor-pointer font-bold"
                  title="Xóa nhánh con này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa nhánh / Delete
                </button>
              )}
            </div>

            {selectedNodeDetails ? (
              <div className="space-y-4">
                {/* Node visual stats */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-slate-500">
                  <p>Cấp độ (Depth): <strong className="text-slate-800">{selectedNodeDetails.depth}</strong></p>
                  <p>Mã hóa Node Id: <strong className="text-slate-800 tracking-wider font-mono">{selectedNodeDetails.id.substring(0, 10)}</strong></p>
                  <p>Con trái: <strong className={selectedNodeDetails.leftId ? "text-emerald-700" : "text-slate-400"}>{selectedNodeDetails.leftId ? 'Có (Yes)' : 'Trống (None)'}</strong></p>
                  <p>Con phải: <strong className={selectedNodeDetails.rightId ? "text-emerald-700" : "text-slate-400"}>{selectedNodeDetails.rightId ? 'Có (Yes)' : 'Trống (None)'}</strong></p>
                </div>

                {/* Edit Value input for dynamic tree mode */}
                {appMode === 'builder' ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 block">Sửa Tiêu Đề Nút:</label>
                      <div className="flex gap-2">
                        <input
                          id="input-rename-node"
                          type="text"
                          maxLength={4}
                          placeholder="Nhập chữ/số"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        />
                        <button
                          id="btn-confirm-rename"
                          onClick={() => handleRenameNode(renameValue)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm shadow-blue-100"
                        >
                          Lưu
                        </button>
                      </div>
                    </div>

                    {/* EASIER INTERACTION: Quick structure adders right in the card */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-550 block">Thao tác tạo nhánh nhanh:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleAddNewNode(selectedNodeDetails.id, 'left')}
                          disabled={selectedNodeDetails.leftId !== null || selectedNodeDetails.depth >= MAX_DEPTH_LIMIT}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold rounded-lg text-[10.5px] disabled:opacity-45 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Nhánh Trái
                        </button>
                        <button
                          onClick={() => handleAddNewNode(selectedNodeDetails.id, 'right')}
                          disabled={selectedNodeDetails.rightId !== null || selectedNodeDetails.depth >= MAX_DEPTH_LIMIT}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold rounded-lg text-[10.5px] disabled:opacity-45 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Nhánh Phải
                        </button>
                      </div>
                      {selectedNodeDetails.depth >= MAX_DEPTH_LIMIT && (
                        <p className="text-[10px] text-amber-600 font-medium">⚠️ Đã đạt giới hạn tối đa {MAX_DEPTH_LIMIT} tầng để hiển thị đẹp nhất.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-150 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-550 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 leading-relaxed font-vietnamese">
                      Bấm mục <strong>"Tự Thiết Kế Cây"</strong> ở góc trên bên phải để có quyền sửa đổi nhãn và dựng thêm các nhánh Trái/Phải cho sơ đồ này!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                Hãy click vào một hình tròn nút trên cây để chỉnh sửa và kiểm tra nhanh các nhánh con!
              </div>
            )}
          </div>
        </section>
      </main>

      {/* DETAILED ANSWER MATCH & EXPLANATION ROW FOR LESSON MODE */}
      <section className="max-w-[1500px] mx-auto p-4 lg:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
        
        {/* Dynamic validation / solution checklist table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-150 pb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              Đáp Án Thực Tế Của Cấu Trúc Hiện Tại (Dynamic Solution Table)
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-vietnamese">
            Khác biệt vượt trội: Bảng dưới đây sẽ tính toán <strong>đáp án đúng thời gian thực</strong> tương ứng với cây mà bạn vừa chỉnh sửa hoặc cài đặt, hỗ trợ đối khớp chính xác!
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-150 text-slate-400 font-bold bg-slate-50">
                  <th className="py-2.5 px-3">Phép Duyệt</th>
                  <th className="py-2.5 px-3">Quy Tắc Quét</th>
                  <th className="py-2.5 px-3">Kết Quả Chuẩn Xác</th>
                  <th className="py-2.5 px-3 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(dynamicSolutions).map(([type, seq]) => {
                  const isCurrentActiveType = traversalType === type;
                  return (
                    <tr 
                      key={type} 
                      onClick={() => setTraversalType(type as any)}
                      className={`cursor-pointer transition-colors ${
                        isCurrentActiveType ? 'bg-emerald-50/50 font-bold' : 'hover:bg-slate-50/75'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-black">
                          {type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-550 text-[11px]">
                        {type === 'LRN' ? 'Trái → Phải → Gốc' :
                         type === 'NRL' ? 'Gốc → Phải → Trái' :
                         type === 'RLN' ? 'Phải → Trái → Gốc' :
                         type === 'RNL' ? 'Phải → Gốc → Trái' :
                         type === 'NLR' ? 'Gốc → Trái → Phải' : 'Trái → Gốc → Phải'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-950 font-semibold tracking-tight text-[11.5px]">
                        {(seq as string[]).join(', ') || 'Nút Trống'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isCurrentActiveType ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                            <Check className="w-3 h-3" />
                            Đang Quét
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* EDUCATIONAL TERMINOLOGY INTERACTIVE CHEATSHEET */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-150 pb-3">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              Địa Lý Cây Nhị Phân - Điểm Huyệt Điểm Sáng (Glow Cheat Sheet)
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-vietnamese">
            Rê chuột (Hover) qua các thẻ định nghĩa thuật ngữ dưới đây để đồ họa cây phát sáng <strong>màu xanh dương</strong> đánh dấu đúng diện phân hộ lý thuyết!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
            <div
              onMouseEnter={() => setHoveredTerm('root')}
              onMouseLeave={() => setHoveredTerm(null)}
              className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-450 cursor-help transition-all group bg-slate-50/50"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700">Nút Gốc (Root Node)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Nút tối cao không có bất kỳ nút cha nào phía trên. Nút gốc hiện thời là <strong>{currentTree.value}</strong>.
              </p>
            </div>

            <div
              onMouseEnter={() => setHoveredTerm('leaf')}
              onMouseLeave={() => setHoveredTerm(null)}
              className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-450 cursor-help transition-all group bg-slate-50/50"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700">Nút Lá (Leaf Nodes)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Nút ngoài rìa không chia nhánh con bên dưới. Giúp nắm phần kết thúc của duyệt nhánh.
              </p>
            </div>

            <div
              onMouseEnter={() => setHoveredTerm('left-subtree')}
              onMouseLeave={() => setHoveredTerm(null)}
              className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-450 cursor-help transition-all group bg-slate-50/50"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700">Nhánh Con Trái (Left Subtree)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Toàn bộ các cấp lá thuộc rẽ nhánh trái gốc, đóng vai trò duyệt đầu tiên trong các hệ tả hướng.
              </p>
            </div>

            <div
              onMouseEnter={() => setHoveredTerm('right-subtree')}
              onMouseLeave={() => setHoveredTerm(null)}
              className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-450 cursor-help transition-all group bg-slate-50/50"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700">Nhánh Con Phải (Right Subtree)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Toàn bộ các nút mọc từ nhánh hữu của nút gốc, được ưu tiên duyệt đầu tiên trong các biến thể nghịch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Classroom references explanation card */}
      <footer className="bg-white border-t border-slate-200 py-8 px-6 mt-12 text-center text-slate-400">
        <div className="max-w-[800px] mx-auto space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            🌳 Binary Tree Traversal Visual Studio
          </p>
          <p className="text-xs leading-relaxed font-vietnamese text-slate-500">
            Ứng dụng hỗ trợ học tập cấu trúc dữ liệu và giải thuật trực quan cao cấp, được phát triển phục vụ sinh viên làm chủ tuyệt đối phương thức duyệt cây và cơ chế đệ quy.
          </p>
          <div className="flex justify-center gap-3 text-[11px] text-slate-500 font-bold">
            <span>💻 Đồ Họa Cập Nhật Thời Gian Thực</span>
            <span>•</span>
            <span>⏱️ Kiểm Soát Đệ Quy Đồng Bộ</span>
            <span>•</span>
            <span>📐 Biên Soạn Cây Tận Tự Do</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
