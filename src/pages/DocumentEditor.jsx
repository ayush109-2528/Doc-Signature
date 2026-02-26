import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Document, Page, pdfjs } from 'react-pdf';
import { DndContext, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { 
  Save, 
  ArrowLeft, 
  Loader2, 
  Type, 
  Palette, 
  Maximize,
  Trash2, 
  PlusCircle,
  AlertCircle
} from 'lucide-react';

// 🔧 WORKER SETUP (Crucial for Vite)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function DocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // --- Signature State ---
  const [showSignature, setShowSignature] = useState(true);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [text, setText] = useState("Double Click to Edit");
  const [color, setColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("cursive");
  const [boxSize, setBoxSize] = useState({ width: 200, height: 60 });

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        // 1. Get the latest version path from DB
        const { data: version } = await supabase
          .from('document_versions')
          .select('file_path')
          .eq('document_id', id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        if (version) {
          // 2. Generate a secure, temporary URL
          const { data } = await supabase.storage
            .from('documents')
            .createSignedUrl(version.file_path, 3600);
          
          if (data) setPdfUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error fetching PDF:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  const handleDragEnd = (event) => {
    const { delta } = event;
    setPosition((prev) => ({
      x: prev.x + delta.x,
      y: prev.y + delta.y,
    }));
  };

  // Helper: Convert Hex to RGB for PDF-Lib
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
  };

  // --- 💾 SAVE & BURN SIGNATURE ---
  const handleSave = async () => {
    if (!pdfUrl) return;
    if (!showSignature) {
      alert("Please add a signature before finishing.");
      return;
    }
    
    setSaving(true);

    try {
      // 1. Load PDF into memory
      const existingPdfBytes = await fetch(pdfUrl).then((res) => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0]; 

      // 2. Calculate Scaling Factor (Screen vs PDF)
      // We render the PDF at 600px width in the browser
      const pdfWidth = firstPage.getWidth();
      const scale = pdfWidth / 600; 

      // 3. Select Font
      let font;
      if (fontFamily === 'serif') font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      else if (fontFamily === 'sans-serif') font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      else if (fontFamily === 'monospace') font = await pdfDoc.embedFont(StandardFonts.Courier);
      else font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

      // 4. Calculate Coordinates (PDF coords start at bottom-left)
      const x = position.x * scale;
      const y = firstPage.getHeight() - (position.y * scale) - (fontSize * scale);

      // 5. Draw Text on PDF
      firstPage.drawText(text, {
        x: x,
        y: y,
        size: fontSize * scale,
        font: font,
        color: hexToRgb(color),
      });

      // 6. Save modified PDF
      const pdfBytes = await pdfDoc.save();
      
      // 7. Upload New Version to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      const fileName = `${user.id}/${Date.now()}-signed.pdf`;
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, pdfBytes, {
        contentType: 'application/pdf'
      });
      if (uploadError) throw uploadError;

      // 8. Create New Version Record in DB
      const { data: currentVer } = await supabase
        .from('document_versions')
        .select('document_id, version_number')
        .eq('document_id', id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      await supabase.from('document_versions').insert({
        document_id: id,
        version_number: currentVer.version_number + 1,
        file_path: fileName,
        created_by: user.id
      });

      // 9. Update Document Status to 'completed'
      await supabase
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', id);

      // 10. Done!
      alert("Success! Document signed and saved.");
      navigate('/'); 

    } catch (error) {
      console.error("Save failed", error);
      alert("Error saving: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-900">
      
      {/* --- Top Bar --- */}
      <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-20">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} /> <span className="hidden sm:inline">Back to Dashboard</span>
        </button>
        
        <div className="flex flex-col items-center">
          <span className="font-semibold text-slate-700">Signing Mode</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">v1.0</span>
        </div>

        <button 
          onClick={handleSave} 
          disabled={saving || !showSignature}
          className={`
            px-5 py-2 rounded-lg flex items-center gap-2 font-medium transition-all shadow-sm
            ${saving || !showSignature 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md text-white'}
          `}
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {saving ? "Signing..." : "Finish & Sign"}
        </button>
      </div>

      {/* --- Toolbar --- */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-6 overflow-x-auto min-h-[64px]">
        {showSignature ? (
          <>
            {/* Color Picker */}
            <div className="flex items-center gap-3">
              <Palette size={18} className="text-slate-400" />
              <div className="flex gap-1.5">
                {['#000000', '#1d4ed8', '#dc2626', '#15803d'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border transition-all hover:scale-110 ${
                      color === c ? 'ring-2 ring-blue-500 ring-offset-2 scale-110' : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200"></div>

            {/* Font Selector */}
            <div className="flex items-center gap-3">
              <Type size={18} className="text-slate-400" />
              <select 
                value={fontFamily} 
                onChange={(e) => setFontFamily(e.target.value)} 
                className="text-sm border-slate-300 rounded-md py-1.5 px-3 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 hover:bg-white transition-colors cursor-pointer"
              >
                <option value="cursive">Handwritten</option>
                <option value="serif">Formal (Serif)</option>
                <option value="sans-serif">Clean (Sans)</option>
                <option value="monospace">Code (Mono)</option>
              </select>
            </div>

            <div className="h-8 w-px bg-slate-200"></div>

            {/* Size Slider */}
            <div className="flex items-center gap-3">
              <Maximize size={18} className="text-slate-400" />
              <input 
                type="range" min="12" max="60" 
                value={fontSize} 
                onChange={(e) => setFontSize(Number(e.target.value))} 
                className="w-24 accent-blue-600 cursor-pointer"
              />
              <span className="text-xs text-slate-500 font-mono w-8">{fontSize}px</span>
            </div>
          </>
        ) : (
          /* Restore Button */
          <div className="flex items-center w-full justify-center sm:justify-start animate-in fade-in slide-in-from-top-2">
            <button 
              onClick={() => setShowSignature(true)}
              className="flex items-center gap-2 text-blue-600 font-medium bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
            >
              <PlusCircle size={20} />
              Restore Signature Field
            </button>
            <span className="ml-4 text-xs text-slate-500 flex items-center gap-1">
              <AlertCircle size={12} />
              You need a signature to finish.
            </span>
          </div>
        )}
      </div>

      {/* --- Main Canvas --- */}
      <div className="flex-1 bg-slate-200/50 overflow-auto flex justify-center p-8 relative">
        <DndContext onDragEnd={handleDragEnd}>
          <div className="relative shadow-2xl transition-shadow duration-500">
            {pdfUrl ? (
              <Document 
                file={pdfUrl} 
                loading={
                  <div className="flex flex-col items-center justify-center h-[800px] w-[600px] bg-white rounded-lg">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                    <p className="text-slate-500 font-medium">Loading Document...</p>
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center h-[800px] w-[600px] bg-white rounded-lg">
                    <AlertCircle className="text-red-500 mb-4" size={40} />
                    <p className="text-red-500 font-medium">Failed to load PDF.</p>
                  </div>
                }
              >
                <Page 
                  pageNumber={1} 
                  width={600} 
                  className="bg-white" 
                  renderTextLayer={false} 
                  renderAnnotationLayer={false} 
                />
                
                {/* Draggable Layer */}
                {showSignature && (
                  <DraggableSignature 
                    x={position.x} 
                    y={position.y} 
                    text={text}
                    setText={setText}
                    color={color}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                    boxSize={boxSize}
                    setBoxSize={setBoxSize}
                    onDelete={() => setShowSignature(false)}
                  />
                )}
              </Document>
            ) : (
              // Initial Loading State
              <div className="flex flex-col items-center justify-center h-[800px] w-[600px] bg-white rounded-lg shadow-sm">
                <Loader2 className="animate-spin text-slate-300 mb-4" size={32} />
              </div>
            )}
          </div>
        </DndContext>
      </div>
    </div>
  );
}

// --- Draggable Component ---
function DraggableSignature({ x, y, text, setText, color, fontFamily, fontSize, boxSize, setBoxSize, onDelete }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'signature-box',
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const style = {
    transform: CSS.Translate.toString(transform),
    top: `${y}px`,
    left: `${x}px`,
    position: 'absolute',
    width: `${boxSize.width}px`,
    height: `${boxSize.height}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        group cursor-move z-50 flex items-center justify-center transition-all duration-200
        ${isEditing 
          ? 'bg-white ring-2 ring-blue-500 shadow-lg' 
          : 'border-2 border-dashed border-blue-400 bg-blue-50/30 hover:bg-blue-100/40 hover:border-blue-500'}
      `}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Delete Button (Hover Only) */}
      {!isEditing && (
        <button 
          onPointerDown={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-3 -right-3 bg-white text-red-500 border border-slate-200 p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:scale-110 z-50"
          title="Remove Signature"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* Input / Display */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
          onPointerDown={(e) => e.stopPropagation()} 
          className="bg-transparent text-center w-full h-full outline-none p-0 m-0"
          style={{ 
            color, 
            fontFamily, 
            fontSize: `${fontSize}px`, 
            fontWeight: 'bold' 
          }}
        />
      ) : (
        <>
          <span 
            className="pointer-events-none select-none px-2 text-center w-full truncate"
            style={{ 
              color, 
              fontFamily, 
              fontSize: `${fontSize}px`, 
              fontWeight: 'bold' 
            }}
          >
            {text}
          </span>
          
          {/* Helper Tooltip */}
          <div className="absolute -bottom-8 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Double-click to edit
          </div>
        </>
      )}
    </div>
  );
}