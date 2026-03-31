"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Search,
  User,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  ScanFace,
  Sparkles,
  Brain,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  studentsApi,
  generalApi,
  faceRecognitionApi,
  Student,
  Department,
  ClassInfo,
} from "@/lib/api";
import { debounce } from "@/lib/utils";
import { API_CONFIG } from "@/lib/constants";
import * as faceapi from '@vladmandic/face-api';

type SearchMode = "face" | "manual";

export default function FaceRecognitionPage() {
  const [searchMode, setSearchMode] = useState<SearchMode>("face");
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [scannedCount, setScannedCount] = useState<number>(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // Image upload state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual search state
  const [rollNumber, setRollNumber] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);

  // Fetch enrolled count and departments/classes on mount
  useEffect(() => {
    const fetchData = async () => {
      const [deptRes, classRes, encRes] = await Promise.all([
        generalApi.getDepartments(),
        generalApi.getClasses(),
        faceRecognitionApi.getAllEncodings(),
      ]);

      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
      if (classRes.success && classRes.data) setClasses(classRes.data);
      if (encRes.success && encRes.data) {
        setScannedCount((encRes.data as unknown[]).length);
      }
    };
    fetchData();

    const loadFaceModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
      } catch (e) {
        console.error("Failed to load browser face models:", e);
      }
    };
    loadFaceModels();
  }, []);

  // Handle file selection
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setSelectedFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Automatically run recognition
    recognizeFace(file);
  };

  // Fast Client-side recognition using WebGL -> Server distance match
  const recognizeFace = async (file: File) => {
    if (!modelsLoaded) {
      toast.error("Browser AI engine still booting... Please wait a second");
      return;
    }
    setIsLoading(true);
    setMatchedStudent(null);
    setConfidence(0);

    try {
      const formData = new FormData();
      formData.append("image", file);

      // WebGL Client-Side Extraction!
      const img = await faceapi.bufferToImage(file);
      const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                              .withFaceLandmarks()
                              .withFaceDescriptor();

      if (!detection) {
        toast.error("Failure: No face detected by the camera. Bring your face into focus and try again.");
        setIsLoading(false);
        return;
      }
      formData.append("face_encoding", JSON.stringify(Array.from(detection.descriptor)));

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch(`${API_CONFIG.BASE_URL}/face/match`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        setMatchedStudent(result.data.student);
        setConfidence(result.data.confidence);
        setScannedCount(result.data.scannedStudents ?? scannedCount);
        toast.success(`Student identified with ${result.data.confidence}% confidence!`);
      } else {
        toast.error(result.error || "No matching student found in the database.");
      }
    } catch (error) {
      console.error("Face recognition error:", error);
      toast.error("Recognition failed. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Manual search handlers
  const handleRollNumberSearch = async () => {
    if (!rollNumber.trim()) {
      toast.error("Please enter a roll number");
      return;
    }
    setIsLoading(true);
    setMatchedStudent(null);
    setSearchResults([]);

    try {
      const response = await studentsApi.searchByRollNumber(rollNumber.trim());
      if (response.success && response.data) {
        setMatchedStudent(response.data);
        toast.success("Student found!");
      }
    } catch {
      toast.error("Student not found");
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedNameSearch = useCallback(
    debounce(async (name: string, dept?: string, year?: string) => {
      if (!name && !dept && !year) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await studentsApi.getAll({
          search: name || undefined,
          department_id: dept || undefined,
          year: year ? parseInt(year) : undefined,
          limit: 10,
        });
        if (response.success && response.data) {
          setSearchResults(response.data);
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    }, 300),
    []
  );

  const resetSearch = () => {
    setCapturedImage(null);
    setSelectedFile(null);
    setMatchedStudent(null);
    setConfidence(0);
    setSearchResults([]);
    setRollNumber("");
    setSearchName("");
    setSelectedDepartment("");
    setSelectedClass("");
    setSelectedYear("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const years = [
    { value: "1", label: "1st Year" },
    { value: "2", label: "2nd Year" },
    { value: "3", label: "3rd Year" },
    { value: "4", label: "4th Year" },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Face Recognition"
        description="AI-powered server-side face recognition — identify students instantly"
      />

      <div className="p-6 lg:p-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Brain className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">Engine</p>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Client WebGL GPU</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <Zap className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">Enrolled Faces</p>
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {scannedCount} student{scannedCount !== 1 ? "s" : ""}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 col-span-2 md:col-span-1">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                <ScanFace className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium uppercase tracking-wide">Model</p>
                <p className="font-semibold text-purple-900 dark:text-purple-100">SSD MobileNet + ResNet</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Search Methods */}
          <div className="space-y-6">
            {/* Mode Toggle */}
            <div className="flex p-1 bg-muted rounded-xl">
              <button
                onClick={() => { setSearchMode("face"); resetSearch(); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === "face"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ScanFace className="h-4 w-4" />
                Face Recognition
              </button>
              <button
                onClick={() => { setSearchMode("manual"); resetSearch(); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === "manual"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Search className="h-4 w-4" />
                Manual Search
              </button>
            </div>

            <AnimatePresence mode="wait">
              {searchMode === "face" ? (
                <motion.div
                  key="face"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Image Upload Area */}
                  <Card>
                    <CardContent className="p-6">
                      {!capturedImage ? (
                        <div className="space-y-4">
                          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-xl">
                            <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                              <ScanFace className="h-8 w-8 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground mb-2">
                              Upload a Face Photo
                            </h3>
                            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                              Our AI will identify the student instantly using server-side neural networks
                            </p>
                            <Button
                              onClick={() => fileInputRef.current?.click()}
                              size="lg"
                            >
                              <Upload className="h-4 w-4" />
                              Choose Image
                            </Button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <img
                              src={capturedImage}
                              alt="Uploaded"
                              className="w-full rounded-xl max-h-72 object-cover"
                            />
                            {isLoading && (
                              <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                <div className="text-center text-white">
                                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                  <p className="text-sm font-medium">Analyzing with AI...</p>
                                  <p className="text-xs text-white/70 mt-1">Running neural network matching</p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-4">
                            <Button variant="outline" onClick={resetSearch} className="flex-1">
                              <X className="h-4 w-4" />
                              Clear
                            </Button>
                            <Button
                              onClick={() => selectedFile && recognizeFace(selectedFile)}
                              className="flex-1"
                              disabled={isLoading || !selectedFile}
                            >
                              <ScanFace className="h-4 w-4" />
                              Re-analyze
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* How it works */}
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">How it works</p>
                      <div className="space-y-2">
                        {[
                          "Image is sent to the backend AI engine",
                          "SSD MobileNet detects the face",
                          "ResNet computes a 128-d face descriptor",
                          "Euclidean distance compared against enrolled students",
                          "Best match returned with confidence score",
                        ].map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5">
                              {i + 1}
                            </span>
                            {step}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Roll Number Search */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Search by Roll Number
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <Input
                            placeholder="Enter roll number (e.g., 2201234)"
                            value={rollNumber}
                            onChange={(e) => setRollNumber(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRollNumberSearch()}
                          />
                        </div>
                        <Button onClick={handleRollNumberSearch} disabled={isLoading}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Advanced Search */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Advanced Search
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        label="Student Name"
                        placeholder="Search by name..."
                        value={searchName}
                        onChange={(e) => {
                          setSearchName(e.target.value);
                          debouncedNameSearch(e.target.value, selectedDepartment, selectedYear);
                        }}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Select
                          label="Department"
                          options={[
                            { value: "", label: "All departments" },
                            ...departments.map((d) => ({ value: d.id, label: d.code })),
                          ]}
                          value={selectedDepartment}
                          onChange={(e) => {
                            setSelectedDepartment(e.target.value);
                            debouncedNameSearch(searchName, e.target.value, selectedYear);
                          }}
                        />
                        <Select
                          label="Year"
                          options={[{ value: "", label: "All years" }, ...years]}
                          value={selectedYear}
                          onChange={(e) => {
                            setSelectedYear(e.target.value);
                            debouncedNameSearch(searchName, selectedDepartment, e.target.value);
                          }}
                        />
                      </div>
                      <Select
                        label="Class"
                        options={[
                          { value: "", label: "All classes" },
                          ...classes
                            .filter((c) => !selectedDepartment || c.department_id === selectedDepartment)
                            .map((c) => ({ value: c.id, label: c.name })),
                        ]}
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                      />
                    </CardContent>
                  </Card>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Search Results ({searchResults.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {searchResults.map((student) => (
                          <motion.div
                            key={student.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => {
                              setMatchedStudent(student);
                              setSearchResults([]);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar size="md">
                                <AvatarImage
                                  src={student.image_url || student.profile_image_url || undefined}
                                  alt={student.name}
                                />
                                <AvatarFallback>
                                  {student.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">{student.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {student.roll_number} • {student.departments?.code}
                                </p>
                              </div>
                            </div>
                            <Badge>Year {student.year}</Badge>
                          </motion.div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column - Result */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Identification Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <Spinner size="lg" />
                      <Brain className="h-4 w-4 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-4 font-medium">
                      AI is processing...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Running neural network matching
                    </p>
                  </div>
                ) : matchedStudent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    {/* Confidence score */}
                    {confidence > 0 && (
                      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-emerald-500" />
                          <span className="font-medium text-emerald-700 dark:text-emerald-300">
                            Match Found
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="success">{confidence}% confidence</Badge>
                        </div>
                      </div>
                    )}

                    {/* Confidence bar */}
                    {confidence > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Confidence</span>
                          <span>{confidence}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${confidence}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className={`h-full rounded-full ${
                              confidence >= 70
                                ? "bg-emerald-500"
                                : confidence >= 50
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Student Photo */}
                    <div className="flex justify-center">
                      <div className="relative">
                        <Avatar size="xl" className="w-32 h-32">
                          <AvatarImage
                            src={matchedStudent.image_url || matchedStudent.profile_image_url || undefined}
                            alt={matchedStudent.name}
                          />
                          <AvatarFallback>
                            {matchedStudent.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 p-2 bg-emerald-500 rounded-full">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Student Info */}
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-foreground">{matchedStudent.name}</h3>
                      <p className="text-muted-foreground mt-1">
                        Roll Number: {matchedStudent.roll_number}
                      </p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Department</p>
                        <p className="font-medium text-foreground mt-1">
                          {matchedStudent.departments?.name || "N/A"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Year</p>
                        <p className="font-medium text-foreground mt-1">
                          {matchedStudent.year}
                          {matchedStudent.year === 1 ? "st" : matchedStudent.year === 2 ? "nd" : matchedStudent.year === 3 ? "rd" : "th"} Year
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                        <p className="font-medium text-foreground mt-1 truncate">{matchedStudent.email}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Class</p>
                        <p className="font-medium text-foreground mt-1">{matchedStudent.classes?.name || "N/A"}</p>
                      </div>
                    </div>

                    {matchedStudent.phone && (
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
                        <p className="font-medium text-foreground mt-1">{matchedStudent.phone}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4 pt-4">
                      <Button variant="outline" onClick={resetSearch} className="flex-1">
                        <RefreshCw className="h-4 w-4" />
                        New Search
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => window.open(`/dashboard/students?id=${matchedStudent.id}`, "_blank")}
                      >
                        <User className="h-4 w-4" />
                        View Profile
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">No Student Selected</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      {searchMode === "face"
                        ? "Upload a photo to identify a student using AI face recognition"
                        : "Search for a student using roll number, name, or other filters"}
                    </p>

                    {scannedCount === 0 && searchMode === "face" && (
                      <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <p className="text-xs">
                            No students have face data yet. Upload photos on the Students page to enable recognition.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
