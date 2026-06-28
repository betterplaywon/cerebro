import { memo, type CSSProperties } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { GraphNode, NodeKind } from '@cerebro/shared';
import type { Vec3 } from '../../lib/layout';
import { NODE_COLORS } from '../../lib/colors';
import { CategoryIcon } from '../CategoryIcon';
import { SCENE } from './scene-config';

/** 노드 종류별 타일 변형 클래스(중첩 삼항 대신 매핑). 미지정 종류는 기본 타일. */
const TILE_VARIANT_CLASS: Partial<Record<NodeKind, string>> = {
  center: ' node-tile--center',
  concept: ' node-tile--concept',
};

/** 노드 위치의 작은 발광 코어 — Bloom이 번지게 해 글래스 타일 뒤로 글로우 헤일로를 만든다(상호작용 없음). */
function NodeGlow({ node, position }: { node: GraphNode; position: Vec3 }) {
  const color = NODE_COLORS[node.kind];
  const isCenter = node.kind === 'center';
  return (
    <mesh position={position}>
      <sphereGeometry
        args={[isCenter ? SCENE.glow.centerRadius : SCENE.glow.branchRadius, 20, 20]}
      />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isCenter ? SCENE.glow.centerEmissive : SCENE.glow.branchEmissive}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

interface NodeTileProps {
  node: GraphNode;
  position: Vec3;
  selected: boolean;
  hovered: boolean;
  onSelect: (node: GraphNode) => void;
}

/** 노드 라벨 = 글래스 아이콘 타일(Html, **시각 전용**: pointer-events 없음).
 *  마우스/터치 선택은 3D 히트 구(NodeHitTarget)가 담당해 드래그-회전을 가로채지 않는다.
 *  키보드 접근성을 위해 button은 유지(포커스+Enter로 선택; pointer-events:none이라 회전엔 영향 없음). */
function NodeTile({ node, position, selected, hovered, onSelect }: NodeTileProps) {
  const isCenter = node.kind === 'center';
  const isConcept = node.kind === 'concept';
  const variant = TILE_VARIANT_CLASS[node.kind] ?? '';
  const stateClass = `${selected ? ' is-selected' : ''}${hovered ? ' is-hover' : ''}`;
  return (
    <Html
      position={position}
      center
      distanceFactor={SCENE.tile.distanceFactor}
      zIndexRange={[0, 0]}
      wrapperClass="node-tile-wrap"
    >
      <button
        type="button"
        className={`node-tile${variant}${stateClass}`}
        style={{ '--node-color': NODE_COLORS[node.kind] } as CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
      >
        {!isConcept && (
          <span className="node-tile__icon">
            <CategoryIcon
              kind={node.kind}
              size={isCenter ? SCENE.tile.centerIcon : SCENE.tile.branchIcon}
            />
          </span>
        )}
        <span className="node-tile__label">{node.label}</span>
      </button>
    </Html>
  );
}

/** 노드별 투명 히트 구 — 클릭=선택, 호버=커서/하이라이트를 3D 레이캐스트로 처리한다.
 *  Html 타일에서 pointer-events를 떼어내 OrbitControls 드래그-회전이 어디서나 동작하게 만든다. */
function NodeHitTarget({
  node,
  position,
  onSelect,
  onHover,
}: {
  node: GraphNode;
  position: Vec3;
  onSelect: (node: GraphNode) => void;
  onHover: (id: string | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const radius = node.kind === 'center' ? SCENE.hit.center : SCENE.hit.branch;
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(node.id);
        gl.domElement.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(null);
        gl.domElement.style.cursor = '';
      }}
    >
      <sphereGeometry args={[radius, 12, 12]} />
      {/* 보이지 않지만 레이캐스트는 받는 표면(visible=false는 레이캐스트 제외되므로 opacity 0 사용). */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

interface NodeViewProps {
  node: GraphNode;
  position: Vec3;
  selected: boolean;
  hovered: boolean;
  onSelect: (node: GraphNode) => void;
  onHover: (id: string | null) => void;
}

/** 노드 1개의 3계층(발광 코어 + 글래스 타일 + 투명 히트구)을 한 번에 emit한다(중심 순회 1회).
 *  React.memo로 감싸 hover/선택 변경 시 **props가 바뀐 노드만** 재렌더하고 나머지는 스킵한다 —
 *  콜백(onSelect/onHover)은 부모의 안정적 setState 참조, node·position도 참조 안정이라 비교가 통과한다.
 *  group이 아닌 Fragment로 묶어 씬 그래프를 평평하게 유지한다(불필요한 Object3D 미생성). */
export const NodeView = memo(function NodeView({
  node,
  position,
  selected,
  hovered,
  onSelect,
  onHover,
}: NodeViewProps) {
  return (
    <>
      <NodeGlow node={node} position={position} />
      <NodeTile
        node={node}
        position={position}
        selected={selected}
        hovered={hovered}
        onSelect={onSelect}
      />
      <NodeHitTarget node={node} position={position} onSelect={onSelect} onHover={onHover} />
    </>
  );
});
