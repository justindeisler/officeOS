import { useState, useRef, useEffect } from 'react';
import { useClientAuthStore } from '../stores/clientAuthStore';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';

// Type definitions
interface Field {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

interface Table {
  name: string;
  fields: Field[];
  x: number;
  y: number;
}

interface Relationship {
  from: string;
  fromField: string;
  to: string;
  toField: string;
}

// Wellfy schema definition
const wellifySchema: { tables: Table[]; relationships: Relationship[] } = {
  tables: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'email', type: 'varchar' },
        { name: 'name', type: 'varchar' },
        { name: 'role', type: 'enum' },
        { name: 'partnerId', type: 'uuid', isForeignKey: true },
      ],
      x: 50,
      y: 50,
    },
    {
      name: 'Partner',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'slug', type: 'varchar' },
        { name: 'name', type: 'varchar' },
        { name: 'status', type: 'enum' },
      ],
      x: 50,
      y: 280,
    },
    {
      name: 'Course',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'title', type: 'varchar' },
        { name: 'slug', type: 'varchar' },
        { name: 'status', type: 'enum' },
        { name: 'instructorId', type: 'uuid', isForeignKey: true },
        { name: 'price', type: 'decimal' },
      ],
      x: 320,
      y: 50,
    },
    {
      name: 'Module',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'courseId', type: 'uuid', isForeignKey: true },
        { name: 'title', type: 'varchar' },
        { name: 'type', type: 'enum' },
        { name: 'order', type: 'int' },
      ],
      x: 590,
      y: 50,
    },
    {
      name: 'Lesson',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'moduleId', type: 'uuid', isForeignKey: true },
        { name: 'title', type: 'varchar' },
        { name: 'type', type: 'enum' },
        { name: 'order', type: 'int' },
      ],
      x: 860,
      y: 50,
    },
    {
      name: 'Enrollment',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'userId', type: 'uuid', isForeignKey: true },
        { name: 'courseId', type: 'uuid', isForeignKey: true },
        { name: 'enrolledAt', type: 'timestamp' },
        { name: 'completedAt', type: 'timestamp' },
      ],
      x: 320,
      y: 280,
    },
    {
      name: 'UserProgress',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'userId', type: 'uuid', isForeignKey: true },
        { name: 'lessonId', type: 'uuid', isForeignKey: true },
        { name: 'completed', type: 'boolean' },
      ],
      x: 860,
      y: 280,
    },
    {
      name: 'Order',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'userId', type: 'uuid', isForeignKey: true },
        { name: 'orderNumber', type: 'varchar' },
        { name: 'status', type: 'enum' },
        { name: 'total', type: 'decimal' },
      ],
      x: 50,
      y: 480,
    },
    {
      name: 'Payment',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'orderId', type: 'uuid', isForeignKey: true },
        { name: 'amount', type: 'decimal' },
        { name: 'status', type: 'enum' },
      ],
      x: 320,
      y: 480,
    },
    {
      name: 'Certificate',
      fields: [
        { name: 'id', type: 'uuid', isPrimaryKey: true },
        { name: 'userId', type: 'uuid', isForeignKey: true },
        { name: 'courseId', type: 'uuid', isForeignKey: true },
        { name: 'certificateNumber', type: 'varchar' },
      ],
      x: 590,
      y: 480,
    },
  ],
  relationships: [
    { from: 'User', fromField: 'partnerId', to: 'Partner', toField: 'id' },
    { from: 'Course', fromField: 'instructorId', to: 'User', toField: 'id' },
    { from: 'Module', fromField: 'courseId', to: 'Course', toField: 'id' },
    { from: 'Lesson', fromField: 'moduleId', to: 'Module', toField: 'id' },
    { from: 'Enrollment', fromField: 'userId', to: 'User', toField: 'id' },
    { from: 'Enrollment', fromField: 'courseId', to: 'Course', toField: 'id' },
    { from: 'UserProgress', fromField: 'userId', to: 'User', toField: 'id' },
    { from: 'UserProgress', fromField: 'lessonId', to: 'Lesson', toField: 'id' },
    { from: 'Order', fromField: 'userId', to: 'User', toField: 'id' },
    { from: 'Payment', fromField: 'orderId', to: 'Order', toField: 'id' },
    { from: 'Certificate', fromField: 'userId', to: 'User', toField: 'id' },
    { from: 'Certificate', fromField: 'courseId', to: 'Course', toField: 'id' },
  ],
};

// Table card component
function TableCard({ table }: { table: Table }) {
  return (
    <div
      className="absolute bg-white rounded-lg shadow-md border border-gray-200 min-w-[200px]"
      style={{ left: table.x, top: table.y }}
    >
      {/* Table header */}
      <div className="bg-slate-800 text-white px-4 py-2 rounded-t-lg font-semibold text-sm">
        {table.name}
      </div>
      {/* Fields */}
      <div className="divide-y divide-gray-100">
        {table.fields.map((field) => (
          <div
            key={field.name}
            className="px-4 py-1.5 flex items-center justify-between gap-4 text-sm"
          >
            <span className="flex items-center gap-2">
              {field.isPrimaryKey && (
                <span className="text-amber-500 font-bold text-xs" title="Primary Key">
                  PK
                </span>
              )}
              {field.isForeignKey && (
                <span className="text-blue-500 font-bold text-xs" title="Foreign Key">
                  FK
                </span>
              )}
              <span className={field.isPrimaryKey ? 'font-medium' : ''}>{field.name}</span>
            </span>
            <span className="text-gray-400 text-xs">{field.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// SVG relationship lines
function RelationshipLines({
  tables,
  relationships,
}: {
  tables: Table[];
  relationships: Relationship[];
}) {
  const getTablePosition = (tableName: string) => {
    const table = tables.find((t) => t.name === tableName);
    if (!table) return { x: 0, y: 0, width: 200, height: 150 };
    const fieldCount = table.fields.length;
    return {
      x: table.x,
      y: table.y,
      width: 200,
      height: 40 + fieldCount * 28, // header + fields
    };
  };

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
        </marker>
      </defs>
      {relationships.map((rel, idx) => {
        const fromPos = getTablePosition(rel.from);
        const toPos = getTablePosition(rel.to);

        // Calculate center points
        const fromCenterX = fromPos.x + fromPos.width / 2;
        const fromCenterY = fromPos.y + fromPos.height / 2;
        const toCenterX = toPos.x + toPos.width / 2;
        const toCenterY = toPos.y + toPos.height / 2;

        // Determine connection points
        let fromX, fromY, toX, toY;

        // Horizontal relationship
        if (Math.abs(fromCenterY - toCenterY) < 100) {
          if (fromCenterX < toCenterX) {
            fromX = fromPos.x + fromPos.width;
            toX = toPos.x;
          } else {
            fromX = fromPos.x;
            toX = toPos.x + toPos.width;
          }
          fromY = fromCenterY;
          toY = toCenterY;
        } else {
          // Vertical relationship
          fromX = fromCenterX;
          toX = toCenterX;
          if (fromCenterY < toCenterY) {
            fromY = fromPos.y + fromPos.height;
            toY = toPos.y;
          } else {
            fromY = fromPos.y;
            toY = toPos.y + toPos.height;
          }
        }

        // Create curved path
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        const curveOffset = 20;

        let path;
        if (Math.abs(fromY - toY) < 50) {
          // Horizontal line with curve
          path = `M ${fromX} ${fromY} C ${fromX + curveOffset} ${fromY}, ${toX - curveOffset} ${toY}, ${toX} ${toY}`;
        } else if (Math.abs(fromX - toX) < 50) {
          // Vertical line with curve
          path = `M ${fromX} ${fromY} C ${fromX} ${fromY + curveOffset}, ${toX} ${toY - curveOffset}, ${toX} ${toY}`;
        } else {
          // Diagonal with bezier curve
          path = `M ${fromX} ${fromY} Q ${midX} ${fromY} ${midX} ${midY} Q ${midX} ${toY} ${toX} ${toY}`;
        }

        return (
          <path
            key={idx}
            d={path}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}

export function ClientArchitecturePage() {
  const { client } = useClientAuthStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if this client should see the Wellfy schema
  const isWellfy = client?.company === 'Wellfy GmbH';

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.4));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.min(Math.max(z + delta, 0.4), 2));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  if (!isWellfy) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Architecture</h1>
          <p className="text-muted-foreground mt-1">Database schema visualization</p>
        </div>
        <div className="flex items-center justify-center h-[60vh] bg-muted/30 rounded-lg border-2 border-dashed">
          <div className="text-center">
            <p className="text-muted-foreground">No architecture diagram available for this client.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Architecture</h1>
          <p className="text-muted-foreground mt-1">Wellfy database schema</p>
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-2 bg-white rounded-lg border shadow-sm p-1">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border" />
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset view">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Diagram container */}
      <div
        ref={containerRef}
        className="relative bg-slate-50 rounded-lg border overflow-hidden flex-1"
        style={{ height: 'calc(100% - 60px)', cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Pan/zoom hint */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
          <Move className="h-3 w-3" />
          Drag to pan • Ctrl+scroll to zoom
        </div>

        {/* Diagram canvas */}
        <div
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '1200px',
            height: '800px',
          }}
        >
          <RelationshipLines tables={wellifySchema.tables} relationships={wellifySchema.relationships} />
          {wellifySchema.tables.map((table) => (
            <TableCard key={table.name} table={table} />
          ))}
        </div>
      </div>
    </div>
  );
}
