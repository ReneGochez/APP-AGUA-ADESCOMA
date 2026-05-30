"use client";

import { useMemo, useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from "firebase/firestore";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  type User 
} from "firebase/auth";
import { db, auth, OperationType, handleFirestoreError } from "@/lib/firebase";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  MapPin, 
  Search, 
  Plus, 
  Check, 
  X, 
  Activity, 
  Layers, 
  AlertTriangle, 
  Compass, 
  Gauge, 
  UserPlus, 
  RefreshCw,
  Database,
  Globe,
  LogIn,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Receipt,
  BarChart3,
  Settings,
  DollarSign,
  CreditCard,
  ChevronRight,
  Sliders
} from "lucide-react";

// Types matching the firebase blueprint
interface Socio {
  id: string;
  numero: string;
  codigo: string;
  nombre: string;
  sector: string;
  zona: string;
  status: "activa" | "suspendida";
  presion: number;
  latitud: number | null;
  longitud: number | null;
  createdAt?: any;
  updatedAt?: any;
}

const DEFAULT_SOCIOS: Omit<Socio, "id">[] = [
  {
    numero: "1024",
    codigo: "SOC-1024",
    nombre: "Juan Pérez Rodríguez",
    sector: "Sector 1 - Centro",
    zona: "Zona Norte",
    status: "activa",
    presion: 42,
    latitud: 14.235,
    longitud: -89.408
  },
  {
    numero: "0842",
    codigo: "SOC-0842",
    nombre: "María Elena Santos",
    sector: "Sector 2 - Vista Hermosa",
    zona: "Zona Centro",
    status: "suspendida",
    presion: 12,
    latitud: 14.241,
    longitud: -89.412
  },
  {
    numero: "1210",
    codigo: "SOC-1210",
    nombre: "Carlos Arana",
    sector: "Sector 3 - Loma",
    zona: "Zona Sur",
    status: "activa",
    presion: 38,
    latitud: 14.228,
    longitud: -89.402
  },
  {
    numero: "1423",
    codigo: "SOC-1423",
    nombre: "Sofia Leticia Gomez",
    sector: "Sector 3 - Loma",
    zona: "Zona Alta",
    status: "activa",
    presion: 45,
    latitud: null,
    longitud: null
  },
  {
    numero: "0955",
    codigo: "SOC-0955",
    nombre: "Roberto Palacios",
    sector: "Sector 1 - Centro",
    zona: "Zona El Tanque",
    status: "activa",
    presion: 35,
    latitud: 14.238,
    longitud: -89.418
  }
];

interface Recibo {
  id: string;
  socioNumero: string;
  socioNombre: string;
  mes: string;
  consumo: number;
  monto: number;
  estado: "pagado" | "pendiente";
  fechaPago?: string;
}

const DEFAULT_RECIBOS: Recibo[] = [
  { id: "REC-01", socioNumero: "1024", socioNombre: "Juan Pérez Rodríguez", mes: "Mayo 2026", consumo: 22, monto: 12.50, estado: "pagado", fechaPago: "2026-05-25" },
  { id: "REC-02", socioNumero: "0842", socioNombre: "María Elena Santos", mes: "Mayo 2026", consumo: 18, monto: 10.00, estado: "pendiente" },
  { id: "REC-03", socioNumero: "1210", socioNombre: "Carlos Arana", mes: "Mayo 2026", consumo: 25, monto: 14.00, estado: "pagado", fechaPago: "2026-05-24" },
  { id: "REC-04", socioNumero: "1423", socioNombre: "Sofia Leticia Gomez", mes: "Mayo 2026", consumo: 30, monto: 16.50, estado: "pendiente" },
  { id: "REC-05", socioNumero: "0955", socioNombre: "Roberto Palacios", mes: "Mayo 2026", consumo: 15, monto: 8.50, estado: "pagado", fechaPago: "2026-05-28" }
];

export default function Home() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"monitoreo" | "facturacion" | "reportes" | "configuracion">("monitoreo");
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "activa" | "suspendida">("todos");
  const [sectorFilter, setSectorFilter] = useState<string>("todos");
  
  // Selection / Detail edit states
  const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Edit Form Fields
  const [editStatusValue, setEditStatusValue] = useState<"activa" | "suspendida">("activa");
  const [editPressureValue, setEditPressureValue] = useState<number>(30);
  const [editLat, setEditLat] = useState<string>("");
  const [editLng, setEditLng] = useState<string>("");

  // New Socio Form Fields
  const [newNombre, setNewNombre] = useState("");
  const [newNumero, setNewNumero] = useState("");
  const [newCodigo, setNewCodigo] = useState("");
  const [newSector, setNewSector] = useState("Sector 1 - Centro");
  const [newZona, setNewZona] = useState("Zona Norte");
  const [newStatus, setNewStatus] = useState<"activa" | "suspendida">("activa");
  const [newPresion, setNewPresion] = useState(35);
  
  // UI helper alerts
  const [savingMsg, setSavingMsg] = useState<string | null>(null);

  // States for Facturación module
  const [recibos, setRecibos] = useState<Recibo[]>(DEFAULT_RECIBOS);
  const [formSocioNum, setFormSocioNum] = useState("");
  const [formMonto, setFormMonto] = useState("");
  const [formConsumo, setFormConsumo] = useState("");
  const [formMes, setFormMes] = useState("Mayo 2026");
  const [facturacionSearch, setFacturacionSearch] = useState("");

  // States for Configuración module
  const [tarifaBase, setTarifaBase] = useState(5.00);
  const [tarifaExcedente, setTarifaExcedente] = useState(0.50);
  const [presionMin, setPresionMin] = useState(15);
  const [presionMax, setPresionMax] = useState(60);
  const [alertasEmail, setAlertasEmail] = useState(true);

  // Check if Maps API Key is defined
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const hasValidMapKey = mapsApiKey && mapsApiKey !== "YOUR_GOOGLE_MAPS_API_KEY";

  // Auth session listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setSavingMsg("Sesión de administrador activa");
      setTimeout(() => setSavingMsg(null), 3000);
    } catch (err) {
      console.error("Login failed: ", err);
      setSavingMsg("Error de autenticación Google");
      setTimeout(() => setSavingMsg(null), 3000);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
      setSavingMsg("Sesión cerrada");
      setTimeout(() => setSavingMsg(null), 3000);
    } catch (err) {
      console.error("Logout failed: ", err);
    }
  };

  // Seed default data helper
  const seedInitialData = async () => {
    try {
      for (const socio of DEFAULT_SOCIOS) {
        try {
          await addDoc(collection(db, "socios"), {
            ...socio,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "socios");
        }
      }
    } catch (e) {
      console.warn("Could not seed data, possibly unauthenticated guest session. Normal behavior.", e);
      setSocios(DEFAULT_SOCIOS.map((s, idx) => ({ ...s, id: `mock-${idx}` } as Socio)));
      setLoading(false);
    }
  };

  // 1. Subscribe to Firestore Socios
  useEffect(() => {
    const q = query(collection(db, "socios"), orderBy("numero", "asc"));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        if (snapshot.empty) {
          // If Firestore collection is empty, seed with initial data so client sees items instantly!
          seedInitialData();
        } else {
          const list: Socio[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              numero: data.numero || "",
              codigo: data.codigo || "",
              nombre: data.nombre || "",
              sector: data.sector || "",
              zona: data.zona || "",
              status: data.status || "activa",
              presion: Number(data.presion) || 0,
              latitud: data.latitud !== undefined && data.latitud !== null ? Number(data.latitud) : null,
              longitud: data.longitud !== undefined && data.longitud !== null ? Number(data.longitud) : null,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          });
          setSocios(list);
          setLoading(false);
        }
      },
      (error) => {
        console.error("Firestore loading failed. Using fallback simulation data: ", error);
        // Fallback directly to simulated mock state to maintain flawless app experience
        const mockList = DEFAULT_SOCIOS.map((s, idx) => ({ ...s, id: `mock-${idx}` } as Socio));
        setSocios(mockList);
        setLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, "socios");
        } catch (err) {
          // Handled, logged inside helper
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync edit form with selected member when selection shifts
  const triggerSelectSocio = (socio: Socio) => {
    setSelectedSocio(socio);
    setShowAddForm(false);
    setEditStatusValue(socio.status);
    setEditPressureValue(socio.presion);
    setEditLat(socio.latitud !== null ? socio.latitud.toString() : "");
    setEditLng(socio.longitud !== null ? socio.longitud.toString() : "");
  };

  // List of unique sectors for filter selection
  const sectorsList = useMemo(() => {
    const list = new Set<string>();
    socios.forEach((s) => {
      if (s.sector) list.add(s.sector);
    });
    return Array.from(list);
  }, [socios]);

  // Compute stats metrics
  const stats = useMemo(() => {
    const total = socios.length;
    const activos = socios.filter((s) => s.status === "activa").length;
    const suspendidos = socios.filter((s) => s.status === "suspendida").length;
    const geolocalizados = socios.filter((s) => s.latitud !== null && s.longitud !== null).length;
    
    // Average pressure logic
    const pressuredSocs = socios.filter((s) => s.presion > 0);
    const avgPressure = pressuredSocs.length > 0 
      ? Math.round(pressuredSocs.reduce((sum, s) => sum + s.presion, 0) / pressuredSocs.length) 
      : 35;

    return { total, activos, suspendidos, geolocalizados, avgPressure };
  }, [socios]);

  // Filtered list based on searches
  const filteredSocios = useMemo(() => {
    return socios.filter((s) => {
      const matchesSearch = 
        s.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.numero.includes(searchQuery);

      const matchesStatus = statusFilter === "todos" || s.status === statusFilter;
      const matchesSector = sectorFilter === "todos" || s.sector === sectorFilter;

      return matchesSearch && matchesStatus && matchesSector;
    });
  }, [socios, searchQuery, statusFilter, sectorFilter]);

  // Save changes to Firestore
  const saveSocioEdits = async () => {
    if (!selectedSocio) return;
    setSavingMsg("Guardando...");
    
    const latNum = editLat.trim() === "" ? null : parseFloat(editLat);
    const lngNum = editLng.trim() === "" ? null : parseFloat(editLng);

    try {
      if (selectedSocio.id.startsWith("mock-")) {
        // Handle client simulated memory edits
        setSocios((prev) =>
          prev.map((s) =>
            s.id === selectedSocio.id
              ? {
                  ...s,
                  status: editStatusValue,
                  presion: editPressureValue,
                  latitud: latNum,
                  longitud: lngNum,
                }
              : s
          )
        );
        // update selection
        setSelectedSocio((prev) => prev ? {
          ...prev,
          status: editStatusValue,
          presion: editPressureValue,
          latitud: latNum,
          longitud: lngNum,
        } : null);
      } else {
        // Real Firestore update
        const docRef = doc(db, "socios", selectedSocio.id);
        try {
          await updateDoc(docRef, {
            status: editStatusValue,
            presion: Number(editPressureValue),
            latitud: latNum,
            longitud: lngNum,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `socios/${selectedSocio.id}`);
        }
      }
      setSavingMsg("Cambios guardados con éxito.");
      setTimeout(() => setSavingMsg(null), 3000);
    } catch (e) {
      console.error("Error updating document: ", e);
      setSavingMsg("Error de escritura (Reglas de Seguridad bloqueadas o sin autenticación)");
      setTimeout(() => setSavingMsg(null), 4000);
    }
  };

  // Create new socio in Firestore
  const createNewSocio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre || !newNumero) {
      alert("Por favor ingrese al menos el nombre y número del socio.");
      return;
    }

    setSavingMsg("Agregando socio...");
    const dataToSave = {
      nombre: newNombre,
      numero: newNumero,
      codigo: newCodigo || `SOC-${newNumero}`,
      sector: newSector,
      zona: newZona,
      status: newStatus,
      presion: Number(newPresion),
      latitud: null,
      longitud: null,
    };

    try {
      let docRef;
      try {
        docRef = await addDoc(collection(db, "socios"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "socios");
      }
      
      // Clear inputs
      setNewNombre("");
      setNewNumero("");
      setNewCodigo("");
      setNewZona("");
      setNewPresion(35);
      setShowAddForm(false);
      
      setSavingMsg("Socio agregado con éxito.");
      setTimeout(() => setSavingMsg(null), 3500);
    } catch (e) {
      console.error("Error adding document to Firestore: ", e);
      // Simulating push on backup mock structure
      const mockNew: Socio = {
        ...dataToSave,
        id: `mock-${Date.now()}`
      };
      setSocios((prev) => [...prev, mockNew]);
      setNewNombre("");
      setNewNumero("");
      setNewCodigo("");
      setNewZona("");
      setShowAddForm(false);
      setSavingMsg("Guardado remotamente denegado. Se agregó a la memoria local (Simulado).");
      setTimeout(() => setSavingMsg(null), 5000);
    }
  };

  // Simulating geolocation click capture
  const handleMapMockClick = (lat: number, lng: number) => {
    if (selectedSocio) {
      setEditLat(lat.toFixed(5));
      setEditLng(lng.toFixed(5));
    } else {
      // Prompt user to select a member first
      setSavingMsg("Seleccione un socio para enlazar coordenadas");
      setTimeout(() => setSavingMsg(null), 3000);
    }
  };

  // Simulated coordinate triggers
  const triggerAutoGeoreference = () => {
    if (!selectedSocio) return;
    // Generate simulated bounds within community area
    const randomLat = 14.23 + Math.random() * 0.015;
    const randomLng = -89.41 - Math.random() * 0.015;
    setEditLat(randomLat.toFixed(5));
    setEditLng(randomLng.toFixed(5));
    setSavingMsg("Coordenada GPS Capturada");
    setTimeout(() => setSavingMsg(null), 2000);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f8f9f5] font-sans text-[#3a3a32] overflow-hidden" id="adescoma_root">
      
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-[#e2e2d5] shrink-0" id="adescoma_header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-sm">
            <Globe className="w-5 h-5" id="header_icon_svg" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#2d2d26] font-serif italic leading-none">ADESCOMA</h1>
            <p className="text-[9px] text-[#8a8a78] uppercase tracking-[0.15em] font-semibold mt-1">Gestión de Agua Comunitaria</p>
          </div>
        </div>
        
        {/* Responsive Dashboard Statistics Banner (Desktop version in page, quick overview here) */}
        {!isMobile && (
          <div className="hidden md:flex gap-6 items-center border-l border-[#e2e2d5] pl-6 h-10">
            <span className="text-xs text-[#8a8a78] uppercase font-bold tracking-wider">Metas de Red:</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <p className="text-xs font-semibold text-[#3a3a32]">{stats.activos} Coberturas Activas</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5A5A40]/40"></span>
              <p className="text-xs font-semibold text-[#8a8a78]">{stats.geolocalizados} de {stats.total} Geodesias</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3.5">
          {user ? (
            <>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none text-[#2d2d26] flex items-center justify-end gap-1">
                  {user.email === "adescoma.proyecto@gmail.com" ? (
                    <span className="flex items-center gap-0.5 text-[#5a5a40]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" /> Administrador
                    </span>
                  ) : (
                    "Colaborador"
                  )}
                </p>
                <p className="text-[10px] text-[#8a8a78] mt-0.5" id="user_email_display">{user.email}</p>
              </div>
              {user.photoURL ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "Avatar"} 
                  className="w-8 h-8 rounded-full border border-[#e2e2d5] shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#d8d8c0] border border-[#e2e2d5] flex items-center justify-center font-bold text-xs text-[#5A5A40] shadow-sm">
                  {user.email ? user.email.substring(0, 2).toUpperCase() : "US"}
                </div>
              )}
              <button
                onClick={handleGoogleLogout}
                title="Cerrar la sesión de administración"
                className="p-1.5 text-[#8a8a78] hover:text-[#5A5A40] hover:bg-[#f1f3ea] rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none text-[#8a8a78]">Modo Consulta</p>
                <p className="text-[9px] text-[#b4b4a0] mt-0.5">Acceda para editar</p>
              </div>
              <button
                onClick={handleGoogleLogin}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#5A5A40] hover:bg-[#454530] text-white rounded-lg transition-all shadow-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Acceder
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex flex-1 overflow-hidden flex-col md:flex-row bg-[#FAFBF8]" id="main_layout_split">
        
        {/* Navigation Sidebar (Desktop) / Bottom Bar (Mobile) */}
        <nav className="flex flex-row md:flex-col justify-around md:justify-start bg-[#FAFBF8] border-b md:border-b-0 md:border-r border-[#e2e2d5] w-full md:w-60 p-2 md:p-4 shrink-0 gap-1.5 md:gap-3 z-30" id="main_navigation_sidebar">
          {/* Brand/Indicator in desktop */}
          <div className="hidden md:block mb-3 px-2">
            <p className="text-[10px] text-[#8a8a78] uppercase tracking-widest font-bold">Módulos</p>
          </div>

          {/* Nav Item: Monitoreo */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("monitoreo");
              setSelectedSocio(null);
            }}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 px-3 py-1.5 md:py-2.5 w-full rounded-xl transition-all cursor-pointer text-left ${
              activeTab === "monitoreo"
                ? "bg-[#E6E9DE] text-[#4A4A30] font-bold shadow-xs border-b-2 md:border-b-0 md:border-l-4 border-[#5A5A40]"
                : "text-[#8a8a78] hover:bg-[#E6E9DE]/55 hover:text-[#4A4A30]"
            }`}
          >
            <Compass className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[9px] md:text-xs tracking-wide uppercase font-semibold md:normal-case">Red de Agua</span>
          </button>

          {/* Nav Item: Facturación */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("facturacion");
              setSelectedSocio(null);
            }}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 px-3 py-1.5 md:py-2.5 w-full rounded-xl transition-all cursor-pointer text-left ${
              activeTab === "facturacion"
                ? "bg-[#E6F0FA] text-[#2C5282] font-bold shadow-xs border-b-2 md:border-b-0 md:border-l-4 border-[#3182CE]"
                : "text-[#8a8a78] hover:bg-[#E6F0FA]/55 hover:text-[#2C5282]"
            }`}
          >
            <Receipt className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[9px] md:text-xs tracking-wide uppercase font-semibold md:normal-case">Facturación</span>
          </button>

          {/* Nav Item: Reportes */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("reportes");
              setSelectedSocio(null);
            }}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 px-3 py-1.5 md:py-2.5 w-full rounded-xl transition-all cursor-pointer text-left ${
              activeTab === "reportes"
                ? "bg-[#F3E8FF] text-[#6B46C1] font-bold shadow-xs border-b-2 md:border-b-0 md:border-l-4 border-[#8B5CF6]"
                : "text-[#8a8a78] hover:bg-[#F3E8FF]/55 hover:text-[#6B46C1]"
            }`}
          >
            <BarChart3 className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[9px] md:text-xs tracking-wide uppercase font-semibold md:normal-case">Estadísticas</span>
          </button>

          {/* Nav Item: Configuración */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("configuracion");
              setSelectedSocio(null);
            }}
            className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 px-3 py-1.5 md:py-2.5 w-full rounded-xl transition-all cursor-pointer text-left ${
              activeTab === "configuracion"
                ? "bg-[#E6FFFA] text-[#234E52] font-bold shadow-xs border-b-2 md:border-b-0 md:border-l-4 border-[#14B8A6]"
                : "text-[#8a8a78] hover:bg-[#E6FFFA]/55 hover:text-[#234E52]"
            }`}
          >
            <Settings className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[9px] md:text-xs tracking-wide uppercase font-semibold md:normal-case">Configuración</span>
          </button>
        </nav>

        {/* Content Container */}
        {activeTab === "monitoreo" ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Drawer / Sidebar: Filter & Select List */}
        <aside className="w-full md:w-[320px] bg-white border-r border-[#e2e2d5] flex flex-col shrink-0 overflow-hidden" id="sidebar_main">
          
          {/* Quick Metrics Panels */}
          <div className="p-4 bg-[#f1f3ea] border-b border-[#e2e2d5] grid grid-cols-3 gap-2 shrink-0">
            <div className="bg-white p-2.5 rounded-xl border border-[#e2e2d5] text-center shadow-xs">
              <p className="text-[8px] text-[#8a8a78] uppercase tracking-wider font-bold">Socios</p>
              <p className="text-lg font-serif font-bold text-[#5A5A40] italic leading-tight mt-0.5">{loading ? "..." : stats.total}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-[#e2e2d5] text-center shadow-xs">
              <p className="text-[8px] text-[#8a8a78] uppercase tracking-wider font-bold">Ubicados</p>
              <p className="text-lg font-serif font-bold text-[#5A5A40] italic leading-tight mt-0.5">
                {stats.geolocalizados}
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-[#e2e2d5] text-center shadow-xs">
              <p className="text-[8px] text-[#8a8a78] uppercase tracking-wider font-bold">Presión M.</p>
              <p className="text-lg font-serif font-bold text-amber-800 italic leading-tight mt-0.5">{stats.avgPressure} PSI</p>
            </div>
          </div>

          {/* Filters & Add Interaction Toolbar */}
          <div className="p-4 border-b border-[#e2e2d5] space-y-3 shrink-0 bg-white">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-bold text-[#8a8a78] uppercase tracking-widest">Sistemas de Control</h2>
              <button 
                onClick={() => {
                  setSelectedSocio(null);
                  setShowAddForm(!showAddForm);
                }}
                className="flex items-center gap-1 text-[10px] text-white bg-[#5A5A40] hover:bg-[#454530] px-2 py-1 rounded-md transition-all font-semibold uppercase shadow-xs cursor-pointer"
                id="add_new_partner_btn"
              >
                <Plus className="w-3 h-3" /> Nuevo
              </button>
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#8a8a78]">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Buscar por código, número o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f8f9f5] border border-[#e2e2d5] hover:border-[#d8d8c0] rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40] text-slate-800 transition-all font-sans"
                id="search_filter_input"
              />
            </div>

            {/* Dropdown Filters row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[8px] uppercase tracking-wider font-bold text-[#8a8a78] block mb-1">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full p-1.5 bg-[#f8f9f5] border border-[#e2e2d5] rounded-lg text-[11px] font-sans"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="activa">Servicio Activo</option>
                  <option value="suspendida">Servicio Suspendido</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] uppercase tracking-wider font-bold text-[#8a8a78] block mb-1">Sector</label>
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="w-full p-1.5 bg-[#f8f9f5] border border-[#e2e2d5] rounded-lg text-[11px] font-sans"
                >
                  <option value="todos">Todos Sectores</option>
                  {sectorsList.map((sect) => (
                    <option key={sect} value={sect}>{sect.replace("Sector ", "")}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Scrolling Partner List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f1f3ea] p-2 space-y-1.5" id="partner_scroll_list">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8a8a78]">
                <RefreshCw className="w-5 h-5 animate-spin text-[#5A5A40]" />
                <p className="text-xs">Cargando base de datos...</p>
              </div>
            ) : filteredSocios.length === 0 ? (
              <div className="text-center py-12 text-[#8a8a78] space-y-1.5">
                <AlertTriangle className="w-6 h-6 mx-auto opacity-70" />
                <p className="text-xs">No se encontraron socios</p>
                <button 
                  onClick={() => { setSearchQuery(""); setStatusFilter("todos"); setSectorFilter("todos"); }}
                  className="text-[10px] text-[#5A5A40] underline font-bold"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              filteredSocios.map((socio) => {
                const isSelected = selectedSocio?.id === socio.id;
                const hasGeo = socio.latitud !== null && socio.longitud !== null;
                
                return (
                  <div
                    key={socio.id}
                    onClick={() => triggerSelectSocio(socio)}
                    className={`p-3 rounded-2xl cursor-pointer border transition-all ${
                      isSelected 
                        ? "bg-[#f1f3ea] border-[#5A5A40] shadow-sm" 
                        : "bg-white hover:bg-[#f8f9f5] border-transparent hover:border-[#e2e2d5]"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-[#2d2d26] truncate max-w-[180px]">{socio.nombre}</p>
                        <p className="text-[10px] text-[#8a8a78] font-mono mt-0.5">
                          #{socio.numero} • {socio.codigo}
                        </p>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-full ${
                        socio.status === "activa" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {socio.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-[#f1f3ea] text-[10px] text-[#8a8a78]">
                      <span className="truncate max-w-[120px]">{socio.zona}</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="flex items-center gap-0.5">
                          <Gauge className="w-2.5 h-2.5" /> {socio.presion} PSI
                        </span>
                        {hasGeo ? (
                          <span className="text-[#5A5A40] flex items-center gap-0.5 font-sans font-semibold">
                            <MapPin className="w-2.5 h-2.5 animate-pulse" /> Georreferenciado
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold bg-amber-50/50 px-1 rounded">No Geo</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Section: Split Map Canvas & Overlay Context forms */}
        <div className="flex-1 relative bg-[#e5e7eb] flex flex-col overflow-hidden" id="maps_workspace">
          
          {/* Main Map Presentation Layer */}
          <div className="absolute inset-0 bg-[#d8dcd3] flex items-center justify-center overflow-hidden" id="interactive_canvas_map">
            
            {/* Grid network representation background */}
            <div 
              className="absolute inset-0 opacity-30" 
              style={{
                backgroundImage: "radial-gradient(#5a5a40 0.5px, transparent 0.5px)",
                backgroundSize: "24px 24px"
              }}
            ></div>

            {/* Simulated Water Pipeline Networks Vector Paths */}
            <svg className="absolute w-full h-full opacity-30 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 800 600">
              {/* Main supply line */}
              <path d="M0,150 Q250,120 500,280 T800,320" fill="none" stroke="#5A5A40" strokeWidth="6" strokeLinecap="round" />
              {/* Distribution branches */}
              <path d="M200,10 Q220,290 120,600" fill="none" stroke="#5A5A40" strokeWidth="3" strokeDasharray="12,6" />
              <path d="M420,240 Q400,380 620,600" fill="none" stroke="#5A5A40" strokeWidth="3" strokeDasharray="8,4" />
              {/* Secondary loop */}
              <circle cx="500" cy="280" r="180" fill="none" stroke="#8a8a78" strokeWidth="2" strokeDasharray="5,10" />
            </svg>

            {/* Mock community geography markers / houses */}
            <div className="absolute top-[18%] left-[25%] opacity-35 text-[#8a8a78] text-[8px] tracking-wider uppercase font-bold text-center">
              <div className="p-1 px-2 border border-[#d8d8c0] bg-white rounded-lg">Sector 1: Tanque Central</div>
            </div>
            <div className="absolute bottom-[20%] left-[15%] opacity-35 text-[#8a8a78] text-[8px] tracking-wider uppercase font-bold text-center">
              <div className="p-1 px-2 border border-[#d8d8c0] bg-white rounded-lg">Sector 2: Distribución Loma</div>
            </div>

            {/* Clickable Area for georeferencing coordinates selection when editing */}
            <div 
              className="absolute inset-0 cursor-crosshair" 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Map screen coordinates mathematically to simulation latitud 14.2xx y longitud -89.4xx
                const mapLat = 14.22 + ((rect.height - y) / rect.height) * 0.03;
                const mapLng = -89.42 + (x / rect.width) * 0.03;
                handleMapMockClick(mapLat, mapLng);
              }}
              title="Haga clic para capturar coordenadas geográficas"
            >
              {/* Map Pins for all geolocated members */}
              {socios.map((soc) => {
                if (soc.latitud === null || soc.longitud === null) return null;

                // Turn simulated coordinate space into relative percentage positions on canvas
                const minLat = 14.22, maxLat = 14.25;
                const minLng = -89.42, maxLng = -89.39;

                const relativeY = 100 - ((soc.latitud - minLat) / (maxLat - minLat)) * 100;
                const relativeX = ((soc.longitud - minLng) / (maxLng - minLng)) * 100;

                const isSelected = selectedSocio?.id === soc.id;

                return (
                  <div
                    key={soc.id}
                    style={{
                      top: `${Math.max(5, Math.min(95, relativeY))}%`,
                      left: `${Math.max(5, Math.min(95, relativeX))}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Avoid double placement trigger
                      triggerSelectSocio(soc);
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 cursor-pointer"
                  >
                    {/* Pulsing signal coordinate marker */}
                    <div className={`absolute -inset-2.5 rounded-full animate-ping opacity-25 ${
                      isSelected ? "bg-[#5A5A40] scale-150" : soc.status === "activa" ? "bg-emerald-500" : "bg-amber-500"
                    }`}></div>

                    {/* Hard pin asset */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all transform shadow-md ${
                      isSelected 
                        ? "bg-[#5A5A40] text-white scale-110 ring-4 ring-white" 
                        : soc.status === "activa" 
                        ? "bg-emerald-500 text-white hover:scale-110" 
                        : "bg-amber-500 text-white hover:scale-110"
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>

                    {/* Pop-up mini badge for name */}
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-[#2d2d26] text-white text-[9px] font-semibold px-2 py-0.5 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                      {soc.nombre} (#{soc.numero})
                    </div>
                  </div>
                );
              })}

              {/* Dynamic clicked location temporary pin identifier */}
              {selectedSocio && editLat && editLng && (
                (() => {
                  const latVal = parseFloat(editLat);
                  const lngVal = parseFloat(editLng);
                  if (isNaN(latVal) || isNaN(lngVal)) return null;

                  const minLat = 14.22, maxLat = 14.25;
                  const minLng = -89.42, maxLng = -89.39;

                  const relY = 100 - ((latVal - minLat) / (maxLat - minLat)) * 100;
                  const relX = ((lngVal - minLng) / (maxLng - minLng)) * 100;

                  return (
                    <div
                      style={{
                        top: `${Math.max(5, Math.min(95, relY))}%`,
                        left: `${Math.max(5, Math.min(95, relX))}%`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                    >
                      <div className="absolute -inset-4 bg-[#5A5A40]/30 rounded-full animate-ping"></div>
                      <div className="w-10 h-10 bg-white border-2 border-[#5A5A40] rounded-full flex items-center justify-center text-[#5A5A40] shadow-xl">
                        <Compass className="w-5 h-5 animate-spin-slow" />
                      </div>
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#5A5A40] text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap uppercase tracking-wider">
                        Nuevo GPS
                      </span>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Floating Instructions Banner */}
          <div className="absolute top-4 left-4 p-3 bg-white/95 backdrop-blur-xs rounded-xl shadow-md border border-[#e2e2d5] max-w-xs pointer-events-none z-10 space-y-1">
            <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider">Mapeo Rápido de Red</p>
            <p className="text-[11px] text-[#8a8a78] leading-tight">
              Seleccione un socio en el listado izquierdo y haga clic en cualquier zona del mapa para fijar sus coordenadas geográficas instantáneamente.
            </p>
          </div>

          {/* Dialog forms / Overlays */}
          {selectedSocio ? (
            /* Selected Socio Georeference & Status Form */
            <div className="absolute top-4 right-4 bottom-4 w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-[#e2e2d5] flex flex-col overflow-hidden z-20" id="socio_editor_overlay">
              <div className="bg-[#5A5A40] p-4 text-white flex justify-between items-start">
                <div>
                  <h3 className="text-base font-serif italic text-white">Editar Georreferencia</h3>
                  <p className="text-[10px] opacity-90 uppercase tracking-wider font-mono mt-1">
                    Socio #{selectedSocio.numero} • {selectedSocio.codigo}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSocio(null)}
                  className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                
                {/* Active user preview profile card */}
                <div className="p-3 bg-[#f1f3ea] rounded-2xl border border-[#e2e2d5]">
                  <p className="text-[9px] font-bold text-[#8a8a78] uppercase">Datos del Socio</p>
                  <p className="text-sm font-bold text-[#2d2d26] mt-0.5">{selectedSocio.nombre}</p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#e2e2d5]/60 text-xs">
                    <div>
                      <span className="text-[#8a8a78] block text-[9px] uppercase">Sector</span>
                      <span className="font-semibold text-slate-800">{selectedSocio.sector}</span>
                    </div>
                    <div>
                      <span className="text-[#8a8a78] block text-[9px] uppercase">Zona comunal</span>
                      <span className="font-semibold text-slate-800">{selectedSocio.zona || "---"}</span>
                    </div>
                  </div>
                </div>

                {/* Main status setup fields */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-[#8a8a78] uppercase tracking-wider">Estadísticas de Conexión</h4>
                  
                  {/* Status Toggle buttons */}
                  <div>
                    <span className="text-[9px] font-bold text-[#8a8a78] uppercase block mb-1.5">Estado del Servicio</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditStatusValue("activa")}
                        className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                          editStatusValue === "activa"
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                            : "bg-[#f8f9f5] text-slate-600 border-[#e2e2d5] hover:bg-[#f1f3ea]"
                        }`}
                      >
                        ACTIVA
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditStatusValue("suspendida")}
                        className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                          editStatusValue === "suspendida"
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-[#f8f9f5] text-slate-600 border-[#e2e2d5] hover:bg-[#f1f3ea]"
                        }`}
                      >
                        SUSPENDIDA
                      </button>
                    </div>
                  </div>

                  {/* Pressure Input */}
                  <div>
                    <label className="text-[9px] font-bold text-[#8a8a78] uppercase block mb-1">
                      Presión Estática: <span className="text-[#5A5A40] text-sm font-serif font-bold italic">{editPressureValue} PSI</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={editPressureValue}
                      onChange={(e) => setEditPressureValue(Number(e.target.value))}
                      className="w-full accent-[#5A5A40] h-1.5 bg-[#e2e2d5] rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#8a8a78] mt-1 font-mono">
                      <span>0 PSI (Red Seca)</span>
                      <span>40 PSI (Común)</span>
                      <span>80 PSI (Alta)</span>
                    </div>
                  </div>
                </div>

                {/* Georeference Field coordinates */}
                <div className="p-4 bg-[#f8f9f5] rounded-2xl border border-[#e2e2d5] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#8a8a78] uppercase">Coordenadas GPS</span>
                    <button
                      type="button"
                      onClick={triggerAutoGeoreference}
                      className="px-2 py-0.5 bg-white hover:bg-[#5A5A40] hover:text-white border border-[#e2e2d5] rounded text-[8px] font-bold transition-all uppercase"
                    >
                      Tomar GPS Actual
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] uppercase font-bold text-[#8a8a78] block mb-0.5">Latitud</span>
                      <input
                        type="text"
                        placeholder="Ej.14.234"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        className="w-full text-xs font-mono p-1.5 bg-white border border-[#e2e2d5] rounded-md outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] uppercase font-bold text-[#8a8a78] block mb-0.5">Longitud</span>
                      <input
                        type="text"
                        placeholder="Ej.-89.408"
                        value={editLng}
                        onChange={(e) => setEditLng(e.target.value)}
                        className="w-full text-xs font-mono p-1.5 bg-white border border-[#e2e2d5] rounded-md outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                  </div>

                  <p className="text-[9px] text-[#8a8a78] leading-tight text-center">
                    También puede pulsar en el mapa para capturar las coordenadas de forma visual.
                  </p>
                </div>

                <div className="pt-2">
                  {user ? (
                    <button
                      onClick={saveSocioEdits}
                      className="w-full bg-[#5A5A40] hover:bg-[#454530] text-white py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-[#5A5A40]/15 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> GUARDAR EN FIRESTORE
                    </button>
                  ) : (
                    <button
                      onClick={handleGoogleLogin}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" /> ENTRAR CON GOOGLE PARA EDITAR
                    </button>
                  )}
                </div>

                {savingMsg && (
                  <div className="text-center p-2 bg-[#f1f3ea] text-emerald-800 text-[10px] font-bold rounded-xl animate-fade-in border border-[#e2e2d5] font-mono uppercase tracking-wider">
                    {savingMsg}
                  </div>
                )}

              </div>
              
              <div className="p-3 bg-[#f8f9f5] border-t border-[#e2e2d5] text-center text-[9px] text-[#8a8a78] font-mono uppercase tracking-wider">
                ID Colección: socios
              </div>
            </div>
          ) : showAddForm ? (
            /* Add New Socio Form */
            <div className="absolute top-4 right-4 bottom-4 w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-[#e2e2d5] flex flex-col overflow-hidden z-20" id="socio_creator_overlay">
              <div className="bg-[#5A5A40] p-4 text-white flex justify-between items-start">
                <div>
                  <h3 className="text-base font-serif italic text-white">Nuevo Registro de Red</h3>
                  <p className="text-[10px] opacity-90 uppercase tracking-widest mt-1">Censo de Cobertura Comunitaria</p>
                </div>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={createNewSocio} className="p-5 flex-1 overflow-y-auto space-y-4">
                
                <div className="space-y-3">
                  {/* Name field */}
                  <div>
                    <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Nombre del Socio</label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre Completo"
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl text-xs outline-none focus:border-[#5A5A40]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Member unique correlative number */}
                    <div>
                      <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Num. Socio</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. 1423"
                        value={newNumero}
                        onChange={(e) => setNewNumero(e.target.value)}
                        className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl text-xs outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                    {/* System Code */}
                    <div>
                      <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Cod. Socio (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej. SOC-1423"
                        value={newCodigo}
                        onChange={(e) => setNewCodigo(e.target.value)}
                        className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl text-xs outline-none focus:border-[#5A5A40]"
                      />
                    </div>
                  </div>

                  {/* Sectors and zones selections */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Sector</label>
                      <select
                        value={newSector}
                        onChange={(e) => setNewSector(e.target.value)}
                        className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl text-xs"
                      >
                        <option value="Sector 1 - Centro">Sector 1 - Centro</option>
                        <option value="Sector 2 - Vista Hermosa">Sector 2 - Vista Hermosa</option>
                        <option value="Sector 3 - Loma">Sector 3 - Loma</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Zona / Barrio</label>
                      <input
                        type="text"
                        placeholder="Ej. Sector Alto"
                        value={newZona}
                        onChange={(e) => setNewZona(e.target.value)}
                        className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>

                  {/* Status selection */}
                  <div>
                    <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Estado Inicial</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as any)}
                      className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl text-xs"
                    >
                      <option value="activa">Servicio Activo (Activa)</option>
                      <option value="suspendida">Servicio Cortado (Suspendida)</option>
                    </select>
                  </div>

                  {/* Pressure Metric */}
                  <div>
                    <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Presión Hidráulica Inicial (PSI)</label>
                    <input
                      type="number"
                      placeholder="35"
                      value={newPresion}
                      onChange={(e) => setNewPresion(Number(e.target.value))}
                      className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  {user ? (
                    <button
                      type="submit"
                      className="w-full bg-[#5A5A40] hover:bg-[#454530] text-white py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-[#5A5A40]/15 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" /> REGISTRAR SOCIO
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" /> ENTRAR CON GOOGLE PARA REGISTRAR
                    </button>
                  )}
                </div>

                {savingMsg && (
                  <div className="text-center p-2 bg-[#f1f3ea] text-[#5A5A40] text-[10px] font-bold rounded-xl font-mono uppercase">
                    {savingMsg}
                  </div>
                )}

              </form>
            </div>
          ) : (
            /* Map Instructions Card placeholder */
            <div className="absolute bottom-4 right-4 p-4 bg-white/95 backdrop-blur-xs rounded-2xl shadow-xl max-w-sm border border-[#e2e2d5] space-y-2.5 pointer-events-auto z-10 transition-all animation-fade-in">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
                  <Compass className="w-3 h-3" />
                </div>
                <h4 className="text-xs font-bold text-[#2d2d26] uppercase tracking-wide">Estado de Georreferenciación</h4>
              </div>

              <div className="text-[11px] text-[#3a3a32] space-y-1">
                <p>Nuestra comunidad cuenta con:</p>
                <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono">
                  <span className="p-1 px-2 bg-[#f1f3ea] rounded text-[#5A5A40] font-bold">{stats.geolocalizados} Geolocalizados</span>
                  <span className="p-1 px-2 bg-[#f1f3ea] rounded text-[#8a8a78] font-bold">{stats.total - stats.geolocalizados} No Ubicados</span>
                </div>
              </div>

              <p className="text-[9px] text-[#8a8a78] leading-normal pt-1 border-t border-[#f1f3ea]">
                Haga clic sobre cualquier socio de la lista lateral izquierda para comenzar sus procesos de ajuste de coordenadas o presiones del caudal.
              </p>
            </div>
          )}

          {/* Interactive Zoom Map mock panel controls */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 z-10">
            <button className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center font-bold text-[#5A5A40] border border-[#e2e2d5] hover:bg-[#f1f3ea] active:scale-95 transition-transform cursor-pointer">+</button>
            <button className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center font-bold text-[#5A5A40] border border-[#e2e2d5] hover:bg-[#f1f3ea] active:scale-95 transition-transform cursor-pointer">−</button>
          </div>

        </div>
        ) : activeTab === "facturacion" ? (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 bg-[#FAFBF8] space-y-6">
            
            {/* Header banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-5 bg-[#E6F0FA] border border-[#BEE3F8] rounded-3xl shadow-xs animate-fade-in">
              <div>
                <span className="px-2 py-0.5 bg-[#3182CE] text-white text-[8px] font-bold tracking-widest rounded-full uppercase">Cobros de Agua</span>
                <h2 className="text-xl font-serif font-bold text-[#2C5282] italic mt-1 leading-none">Módulo de Facturación y Control de Pagos</h2>
                <p className="text-xs text-[#4A5568] mt-1">Cuentas corrientes de agua y cobros comunitarios de ADESCOMA</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setSavingMsg("Recibos de Agua Generados para este Mes");
                  setTimeout(() => setSavingMsg(null), 3000);
                }}
                className="px-3.5 py-1.5 bg-[#3182CE] hover:bg-[#2B6CB0] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer uppercase tracking-wider"
              >
                Generar Recibos del Mes
              </button>
            </div>

            {/* Quick Metrics Panels */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#e2e2d5] shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-[#8a8a78] uppercase tracking-wider font-bold">Total Recaudado (Mayo)</p>
                  <p className="text-2xl font-serif font-bold text-[#2C5282] italic leading-tight mt-1">
                    ${recibos.filter(r => r.estado === "pagado").reduce((sum, r) => sum + r.monto, 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[#8a8a78] mt-0.5">De {recibos.filter(r => r.estado === "pagado").length} recibos solventes</p>
                </div>
                <div className="w-10 h-10 bg-[#E6F0FA] text-[#3182CE] rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#e2e2d5] shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-[#8a8a78] uppercase tracking-wider font-bold">Cuentas Pendientes</p>
                  <p className="text-2xl font-serif font-bold text-amber-700 italic leading-tight mt-1">
                    ${recibos.filter(r => r.estado === "pendiente").reduce((sum, r) => sum + r.monto, 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[#8a8a78] mt-0.5">{recibos.filter(r => r.estado === "pendiente").length} recibos en mora</p>
                </div>
                <div className="w-10 h-10 bg-[#FFFaf0] text-amber-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#e2e2d5] shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-[#8a8a78] uppercase tracking-wider font-bold">Tasa de Cobro</p>
                  <p className="text-2xl font-serif font-bold text-[#2F855A] italic leading-tight mt-1">
                    {Math.round((recibos.filter(r => r.estado === "pagado").length / recibos.length) * 100)}%
                  </p>
                  <div className="w-24 h-1.5 bg-[#f1f3ea] rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full" 
                      style={{ width: `${(recibos.filter(r => r.estado === "pagado").length / recibos.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-10 h-10 bg-[#E6F6EB] text-[#2F855A] rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Split layout: Bills List vs Payment Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Bills Table */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 lg:col-span-2 space-y-4 flex flex-col shadow-xs">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Historial de Recibos y Cobranza</h3>
                  <div className="relative w-full sm:w-64">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-[#8a8a78]">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Filtrar por socio o número..."
                      value={facturacionSearch}
                      onChange={(e) => setFacturacionSearch(e.target.value)}
                      className="w-full bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#3182CE] text-slate-800"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#e2e2d5] text-[#8a8a78] font-bold uppercase text-[9px] tracking-wider">
                        <th className="py-2.5">Código Recibo</th>
                        <th className="py-2.5">Socio</th>
                        <th className="py-2.5">Mes</th>
                        <th className="py-2.5 text-center">Consumo</th>
                        <th className="py-2.5 text-right">Monto</th>
                        <th className="py-2.5 text-center">Estado</th>
                        <th className="py-2.5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f3ea] text-slate-800">
                      {recibos
                        .filter(r => r.socioNombre.toLowerCase().includes(facturacionSearch.toLowerCase()) || r.socioNumero.includes(facturacionSearch) || r.id.includes(facturacionSearch))
                        .map((r) => (
                          <tr key={r.id} className="hover:bg-[#f8f9f5]/65 transition-colors">
                            <td className="py-3 font-mono font-bold text-[#2C5282]">{r.id}</td>
                            <td className="py-3">
                              <p className="font-bold">{r.socioNombre}</p>
                              <p className="text-[10px] text-[#8a8a78] font-mono">#{r.socioNumero}</p>
                            </td>
                            <td className="py-3 text-[#5A5A40] font-semibold">{r.mes}</td>
                            <td className="py-3 text-center font-mono font-semibold">{r.consumo} m³</td>
                            <td className="py-3 text-right font-mono font-bold text-[#2d2d26]">${r.monto.toFixed(2)}</td>
                            <td className="py-3 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                                r.estado === "pagado"
                                  ? "bg-[#E6F6EB] text-[#2F855A] border border-[#C6F6D5]"
                                  : "bg-[#FFF5F5] text-[#C53030] border border-[#FEB2B2]"
                              }`}>
                                {r.estado === "pagado" ? "PAGADO" : "PENDIENTE"}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              {r.estado === "pendiente" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecibos(prev => prev.map(item => item.id === r.id ? { ...item, estado: "pagado", fechaPago: new Date().toISOString().split('T')[0] } : item));
                                    setSavingMsg(`¡Pago del recibo ${r.id} registrado con éxito!`);
                                    setTimeout(() => setSavingMsg(null), 3000);
                                  }}
                                  className="px-2 py-1 bg-[#3182CE] hover:bg-[#2B6CB0] text-white rounded-md text-[9px] font-bold transition-all shadow-xs cursor-pointer uppercase"
                                >
                                  Cobrar
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#8a8a78] font-mono">{r.fechaPago}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: New Payment Form */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-4 shadow-xs">
                <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Registrar Nuevo Recibo / Pago</h3>
                <p className="text-xs text-[#8a8a78]">Registra consumos manuales de agua y genera cobros inmediatos en el sistema.</p>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!formSocioNum || !formConsumo || !formMonto) {
                      alert("Por favor rellene todos los campos.");
                      return;
                    }
                    const socio = socios.find(s => s.numero === formSocioNum) || DEFAULT_SOCIOS.find(s => s.numero === formSocioNum);
                    const nombre = socio ? socio.nombre : `Socio #${formSocioNum}`;
                    const nuevoRecibo: Recibo = {
                      id: `REC-${String(recibos.length + 1).padStart(2, '0')}`,
                      socioNumero: formSocioNum,
                      socioNombre: nombre,
                      mes: formMes,
                      consumo: Number(formConsumo),
                      monto: Number(formMonto),
                      estado: "pendiente"
                    };
                    setRecibos(prev => [nuevoRecibo, ...prev]);
                    setFormSocioNum("");
                    setFormConsumo("");
                    setFormMonto("");
                    setSavingMsg(`Recibo ${nuevoRecibo.id} generado exitosamente.`);
                    setTimeout(() => setSavingMsg(null), 3000);
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Seleccionar Socio</label>
                    <select
                      value={formSocioNum}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormSocioNum(val);
                        setFormConsumo("20");
                        setFormMonto("10.00");
                      }}
                      required
                      className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl outline-none"
                    >
                      <option value="">-- Seleccionar Socio --</option>
                      {socios.map(s => (
                        <option key={s.id} value={s.numero}>{s.nombre} (#{s.numero})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Consumo (m³)</label>
                      <input
                        type="number"
                        placeholder="Ej. 18"
                        value={formConsumo}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormConsumo(e.target.value);
                          const excess = Math.max(0, val - 10);
                          const calculated = tarifaBase + excess * tarifaExcedente;
                          setFormMonto(calculated.toFixed(2));
                        }}
                        required
                        className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Monto a Cobrar ($)</label>
                      <input
                        type="text"
                        placeholder="Ej. 10.00"
                        value={formMonto}
                        onChange={(e) => setFormMonto(e.target.value)}
                        required
                        className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl outline-none font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-[#8a8a78] uppercase mb-1 block">Período de Facturación</label>
                    <select
                      value={formMes}
                      onChange={(e) => setFormMes(e.target.value)}
                      className="w-full p-2 bg-[#f8f9f5] border border-[#e2e2d5] rounded-xl outline-none"
                    >
                      <option value="Mayo 2026">Mayo 2026</option>
                      <option value="Junio 2026">Junio 2026</option>
                      <option value="Julio 2026">Julio 2026</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#3182CE] hover:bg-[#2B6CB0] text-white py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-[#3182CE]/15 flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Registrar e Imprimir Recibo
                  </button>
                </form>

                {savingMsg && (
                  <div className="text-center p-2 bg-[#f1f3ea] text-emerald-800 text-[10px] font-bold rounded-xl animate-fade-in border border-[#e2e2d5] font-mono uppercase tracking-wider">
                    {savingMsg}
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : activeTab === "reportes" ? (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 bg-[#FAFBF8] space-y-6 animate-fade-in">
            
            {/* Header banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-5 bg-[#F3E8FF] border border-[#E9D8FD] rounded-3xl shadow-xs">
              <div>
                <span className="px-2 py-0.5 bg-[#8B5CF6] text-white text-[8px] font-bold tracking-widest rounded-full uppercase font-sans">Analíticas</span>
                <h2 className="text-xl font-serif font-bold text-[#6B46C1] italic mt-1 leading-none">Estadísticas y Reportes de la Red</h2>
                <p className="text-xs text-[#4A5568] mt-1">Monitoreo de consumos hidráulicos y avance de censos de red</p>
              </div>
              <div className="text-xs font-semibold text-[#6B46C1] bg-white/70 px-3 py-1.5 rounded-xl border border-[#E9D8FD]">
                Fecha: {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            {/* Grid Layout of Report Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card 1: Consumo por Sectores */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Volumen Consumido por Sector</h3>
                  <p className="text-[11px] text-[#8a8a78]">Metros cúbicos de agua distribuidos durante el último mes.</p>
                </div>

                <div className="space-y-3.5 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Sector 1 - Centro</span>
                      <span className="font-mono text-[#5A5A40]">340 m³ (35%)</span>
                    </div>
                    <div className="w-full h-3.5 bg-[#FAFBF8] border border-[#e2e2d5] rounded-full overflow-hidden">
                      <div className="bg-[#D3E0EA] h-full rounded-full transition-all duration-1000" style={{ width: "35%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Sector 2 - Vista Hermosa</span>
                      <span className="font-mono text-[#5A5A40]">210 m³ (22%)</span>
                    </div>
                    <div className="w-full h-3.5 bg-[#FAFBF8] border border-[#e2e2d5] rounded-full overflow-hidden">
                      <div className="bg-[#FFE8D6] h-full rounded-full transition-all duration-1000" style={{ width: "22%" }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>Sector 3 - Loma</span>
                      <span className="font-mono text-[#5A5A40]">415 m³ (43%)</span>
                    </div>
                    <div className="w-full h-3.5 bg-[#FAFBF8] border border-[#e2e2d5] rounded-full overflow-hidden">
                      <div className="bg-[#E2F0D9] h-full rounded-full transition-all duration-1000" style={{ width: "43%" }}></div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-[#8a8a78] leading-tight pt-2 border-t border-[#f1f3ea] italic">
                  * El consumo total acumulado en la comunidad ADESCOMA es de 965 m³.
                </p>
              </div>

              {/* Card 2: Niveles de Presión de Agua */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Estado de Presión Estática</h3>
                  <p className="text-[11px] text-[#8a8a78]">Salud hidráulica de la red de tuberías de ADESCOMA.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-around gap-4 pt-2">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="50" fill="none" stroke="#F1F3EA" strokeWidth="12" />
                      <circle cx="64" cy="64" r="50" fill="none" stroke="#8B5CF6" strokeWidth="12" strokeDasharray="314" strokeDashoffset={314 - (314 * (stats.avgPressure || 35)) / 80} strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute text-center">
                      <p className="text-2xl font-serif font-bold text-[#6B46C1] italic leading-none">{stats.avgPressure} <span className="text-xs">PSI</span></p>
                      <p className="text-[8px] text-[#8a8a78] uppercase tracking-wider mt-1 font-bold">Presión Media</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs w-full sm:w-auto">
                    <div className="flex justify-between sm:justify-start items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]"></span>
                      <span className="font-semibold text-slate-800">Promedio: {stats.avgPressure} PSI</span>
                    </div>
                    <div className="flex justify-between sm:justify-start items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#5A5A40]"></span>
                      <span className="font-semibold text-slate-800">Presión Máxima: 52 PSI</span>
                    </div>
                    <div className="flex justify-between sm:justify-start items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span className="font-semibold text-slate-800">Límites: {presionMin} - {presionMax} PSI</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-[#8a8a78] leading-tight pt-2 border-t border-[#f1f3ea] flex items-center gap-1.5 font-semibold text-[#5A5A40]">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Niveles generales de presión estables y sin fugas mayores reportadas.
                </p>
              </div>

              {/* Card 3: Avance de Geolocalización del Censo */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Avance del Mapeo Geográfico</h3>
                  <p className="text-[11px] text-[#8a8a78]">Progreso de geolocalización de las acometidas de agua.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Sectores Georreferenciados</span>
                    <span className="font-mono text-[#5A5A40]">{stats.geolocalizados} de {stats.total} socios ({stats.total > 0 ? Math.round((stats.geolocalizados / stats.total) * 100) : 0}%)</span>
                  </div>

                  <div className="w-full h-4 bg-[#FAFBF8] border border-[#e2e2d5] rounded-full overflow-hidden">
                    <div 
                      className="bg-[#D3E0EA] h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${stats.total > 0 ? (stats.geolocalizados / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-[#FAFBF8] border border-[#e2e2d5] p-3 rounded-2xl text-center">
                      <p className="text-[9px] text-[#8a8a78] uppercase font-bold">Faltan Ubicar</p>
                      <p className="text-xl font-serif font-bold text-[#8a8a78] italic mt-0.5">{stats.total - stats.geolocalizados}</p>
                    </div>
                    <div className="bg-[#FAFBF8] border border-[#e2e2d5] p-3 rounded-2xl text-center">
                      <p className="text-[9px] text-[#8a8a78] uppercase font-bold">Zonas Cubiertas</p>
                      <p className="text-xl font-serif font-bold text-emerald-800 italic mt-0.5">3 / 3</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Bitácora de Eventos de Red */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-3.5 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Historial de Operaciones Recientes</h3>
                  <p className="text-[11px] text-[#8a8a78]">Historial de acciones registradas en el sistema ADESCOMA.</p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 text-xs max-h-44 pt-2 divide-y divide-[#f1f3ea]">
                  <div className="py-2 flex justify-between gap-2">
                    <p className="font-semibold text-slate-800">Socio #1423 Sofia Leticia Gómez agregada al padrón</p>
                    <span className="text-[9px] text-[#8a8a78] font-mono">16:15</span>
                  </div>
                  <div className="py-2 flex justify-between gap-2">
                    <p className="font-semibold text-slate-800">Georreferencia vinculada a socio #1024 Juan Pérez</p>
                    <span className="text-[9px] text-[#8a8a78] font-mono">15:30</span>
                  </div>
                  <div className="py-2 flex justify-between gap-2">
                    <p className="font-semibold text-slate-800">Presión ajustada a 42 PSI en Sector Centro</p>
                    <span className="text-[9px] text-[#8a8a78] font-mono">14:02</span>
                  </div>
                  <div className="py-2 flex justify-between gap-2">
                    <p className="font-semibold text-[#6B46C1]">Base de datos sincronizada con Firebase Cloud</p>
                    <span className="text-[9px] text-[#6B46C1] font-mono">12:00</span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    setSavingMsg("Descargando reporte en formato PDF...");
                    setTimeout(() => setSavingMsg(null), 3000);
                  }}
                  className="w-full py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer uppercase text-center"
                >
                  Descargar Reporte Completo (PDF)
                </button>
              </div>

            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 bg-[#FAFBF8] space-y-6 animate-fade-in">
            
            {/* Header banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-5 bg-[#E6FFFA] border border-[#B2F5EA] rounded-3xl shadow-xs">
              <div>
                <span className="px-2 py-0.5 bg-[#14B8A6] text-white text-[8px] font-bold tracking-widest rounded-full uppercase">Sistema</span>
                <h2 className="text-xl font-serif font-bold text-[#234E52] italic mt-1 leading-none">Configuración General del Sistema</h2>
                <p className="text-xs text-[#4A5568] mt-1">Gestión de tarifas del recurso hídrico y umbrales de seguridad de la red</p>
              </div>
              <span className="text-[10px] font-mono text-[#234E52] bg-white/70 px-3 py-1 rounded-xl border border-[#B2F5EA]">
                Versión: v1.2.0-modular
              </span>
            </div>

            {/* Split layout: Rates configuration vs Safety Thresholds */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Tarifas de Agua */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#14B8A6]" />
                  <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Tarifas y Cuotas de Agua</h3>
                </div>
                <p className="text-xs text-[#8a8a78]">Configura el costo del servicio básico de agua y tarifas adicionales por exceso de consumo en la comunidad.</p>

                <div className="space-y-4 pt-2 text-xs">
                  <div className="p-3 bg-[#FAFBF8] border border-[#e2e2d5] rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="font-bold block text-slate-800">Cuota Básica Mensual</span>
                      <span className="text-[10px] text-[#8a8a78]">Incluye hasta 10 m³ de agua</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setTarifaBase(prev => Math.max(0, prev - 0.5))}
                        className="w-7 h-7 bg-white rounded-lg border border-[#e2e2d5] font-bold flex items-center justify-center text-slate-700 hover:bg-gray-50 cursor-pointer"
                      >-</button>
                      <span className="font-mono font-bold text-sm w-12 text-center text-slate-800">${tarifaBase.toFixed(2)}</span>
                      <button 
                        type="button"
                        onClick={() => setTarifaBase(prev => prev + 0.5)}
                        className="w-7 h-7 bg-white rounded-lg border border-[#e2e2d5] font-bold flex items-center justify-center text-slate-700 hover:bg-gray-50 cursor-pointer"
                      >+</button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAFBF8] border border-[#e2e2d5] rounded-2xl flex justify-between items-center">
                    <div>
                      <span className="font-bold block text-slate-800">Tarifa por m³ Excedente</span>
                      <span className="text-[10px] text-[#8a8a78]">Aplicado después de los 10 m³</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setTarifaExcedente(prev => Math.max(0, prev - 0.05))}
                        className="w-7 h-7 bg-white rounded-lg border border-[#e2e2d5] font-bold flex items-center justify-center text-slate-700 hover:bg-gray-50 cursor-pointer"
                      >-</button>
                      <span className="font-mono font-bold text-sm w-12 text-center text-slate-800">${tarifaExcedente.toFixed(2)}</span>
                      <button 
                        type="button"
                        onClick={() => setTarifaExcedente(prev => prev + 0.05)}
                        className="w-7 h-7 bg-white rounded-lg border border-[#e2e2d5] font-bold flex items-center justify-center text-slate-700 hover:bg-gray-50 cursor-pointer"
                      >+</button>
                    </div>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    setSavingMsg("Tarifas de cobro actualizadas en el sistema");
                    setTimeout(() => setSavingMsg(null), 3000);
                  }}
                  className="w-full py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer uppercase text-center mt-2"
                >
                  Guardar Tarifas
                </button>
              </div>

              {/* Box 2: Umbrales de Seguridad Hidráulica */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#14B8A6]" />
                    <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Umbrales de Presión y Alertas</h3>
                  </div>
                  <p className="text-xs text-[#8a8a78] mt-1">Define rangos normales de presión estática para generar alertas automáticas en el mapa.</p>
                </div>

                <div className="space-y-3.5 pt-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-[#8a8a78] uppercase block mb-1">
                      Presión Mínima Permitida: <span className="font-mono text-[#14B8A6] font-bold">{presionMin} PSI</span>
                    </label>
                    <input 
                      type="range"
                      min="5"
                      max="30"
                      value={presionMin}
                      onChange={(e) => setPresionMin(Number(e.target.value))}
                      className="w-full accent-[#14B8A6] h-1 bg-[#e2e2d5] rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#8a8a78] uppercase block mb-1">
                      Presión Máxima Permitida: <span className="font-mono text-[#14B8A6] font-bold">{presionMax} PSI</span>
                    </label>
                    <input 
                      type="range"
                      min="40"
                      max="80"
                      value={presionMax}
                      onChange={(e) => setPresionMax(Number(e.target.value))}
                      className="w-full accent-[#14B8A6] h-1 bg-[#e2e2d5] rounded-lg cursor-pointer"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-3 bg-[#FAFBF8] border border-[#e2e2d5] rounded-2xl cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={alertasEmail}
                      onChange={(e) => setAlertasEmail(e.target.checked)}
                      className="w-4 h-4 accent-[#14B8A6] cursor-pointer"
                    />
                    <div>
                      <span className="font-bold block text-slate-800">Alertas de baja presión</span>
                      <span className="text-[10px] text-[#8a8a78]">Enviar alerta al correo de soporte técnico</span>
                    </div>
                  </label>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    setSavingMsg("Límites de presión actualizados correctamente");
                    setTimeout(() => setSavingMsg(null), 3000);
                  }}
                  className="w-full py-2 bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer uppercase text-center mt-2"
                >
                  Guardar Parámetros de Alerta
                </button>
              </div>

              {/* Box 3: Base de Datos & Mantenimiento */}
              <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 space-y-4 shadow-xs md:col-span-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#14B8A6]" />
                  <h3 className="text-sm font-bold text-[#2d2d26] uppercase tracking-wider">Conexión y Mantenimiento de Datos</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
                  <div className="p-3 bg-[#E6F6EB] border border-[#C6F6D5] rounded-2xl">
                    <span className="text-[10px] text-[#2F855A] uppercase tracking-wider font-bold block">Base de Datos</span>
                    <span className="text-sm font-bold text-[#2F855A] block mt-0.5">Firebase Connected</span>
                    <span className="text-[10px] text-[#5A5A40]">Firestore Activo y Sincronizado</span>
                  </div>

                  <div className="p-3 bg-[#E6F0FA] border border-[#BEE3F8] rounded-2xl">
                    <span className="text-[10px] text-[#2C5282] uppercase tracking-wider font-bold block">Colección Activa</span>
                    <span className="text-sm font-bold text-[#2C5282] block mt-0.5">socios</span>
                    <span className="text-[10px] text-[#8a8a78]">Esquema del censo de red</span>
                  </div>

                  <div className="p-3 bg-white border border-[#e2e2d5] rounded-2xl flex flex-col justify-center">
                    <span className="text-[10px] text-[#8a8a78] uppercase tracking-wider font-bold block mb-1">Mantenimiento</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setSavingMsg("Restaurando datos iniciales...");
                        await seedInitialData();
                        setSavingMsg("¡Base de datos restaurada con éxito!");
                        setTimeout(() => setSavingMsg(null), 3000);
                      }}
                      className="px-2.5 py-1.5 bg-[#FAFBF8] border border-[#e2e2d5] hover:bg-[#E6E9DE]/65 text-slate-800 text-[10px] font-bold rounded-lg transition-all cursor-pointer uppercase text-center"
                    >
                      Restaurar Datos Iniciales
                    </button>
                  </div>
                </div>

                {savingMsg && (
                  <div className="text-center p-2 bg-[#f1f3ea] text-emerald-800 text-[10px] font-bold rounded-xl animate-fade-in border border-[#e2e2d5] font-mono uppercase tracking-wider">
                    {savingMsg}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </main>

      {/* Footer Status Bar with Natural Tones */}
      <footer className="px-6 py-2 bg-[#5A5A40] text-white flex justify-between items-center text-[9px] uppercase tracking-[0.18em] font-medium shrink-0" id="footer_bar">
        <div className="flex gap-4 md:gap-6 items-center flex-wrap">
          <span className="flex items-center gap-1.5 font-bold"><Database className="w-3.5 h-3.5 text-emerald-300" /> Firebase: Conectado</span>
          <span className="flex items-center gap-1.5 font-bold"><Globe className="w-3.5 h-3.5 text-emerald-300" /> Red de Caudal: Activo</span>
          <span>© 2026 ADESCOMA - Desarrollo Sostenible</span>
        </div>
        <div className="opacity-95 hidden sm:block">Proyecto de Agua Comunitario</div>
      </footer>

    </div>
  );
}
