"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  Search,
  User,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  ImagePlus,
  ScanFace,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
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

type SearchMode = "face" | "manual";

export default function FaceRecognitionPage() {
  // State
  const [searchMode, setSearchMode] = useState<SearchMode>("face");
  const [isLoading, setIsLoading] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [faceApiError, setFaceApiError] = useState<string | null>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Manual search state
  const [rollNumber, setRollNumber] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);

  // Load face-api.js
  useEffect(() => {
    const loadFaceApi = async () => {
      try {
        // Dynamic import for face-api.js
        const faceapi = await import("face-api.js");

        // Load models from CDN
        const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Fallback detector - more accurate
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setFaceApiLoaded(true);
      } catch (error) {
        console.error("Failed to load face-api.js:", error);
        setFaceApiError("Failed to load face recognition models");
      }
    };

    loadFaceApi();
  }, []);

  // Fetch departments and classes
  useEffect(() => {
    const fetchData = async () => {
      const [deptRes, classRes] = await Promise.all([
        generalApi.getDepartments(),
        generalApi.getClasses(),
      ]);

      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
      if (classRes.success && classRes.data) setClasses(classRes.data);
    };

    fetchData();
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      toast.error("Failed to access camera. Please check permissions.");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Capture image from camera
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(imageData);
        stopCamera();
        recognizeFace(imageData);
      }
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setCapturedImage(imageData);
      recognizeFace(imageData);
    };
    reader.readAsDataURL(file);
  };

  // Recognize face
  const recognizeFace = async (imageData: string) => {
    if (!faceApiLoaded) {
      toast.error("Face recognition models not loaded yet");
      return;
    }

    setIsLoading(true);
    setMatchedStudent(null);
    setConfidence(0);

    try {
      const faceapi = await import("face-api.js");

      // Create image element
      const img = document.createElement("img");
      img.src = imageData;
      await new Promise((resolve) => (img.onload = resolve));

      // Try TinyFaceDetector first with lenient settings
      const tinyOptions = new faceapi.TinyFaceDetectorOptions({ 
        inputSize: 320, 
        scoreThreshold: 0.2 // Even lower threshold
      });
      
      let detection = await faceapi
        .detectSingleFace(img, tinyOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      // If TinyFaceDetector fails, try SSD MobileNet (more accurate but slower)
      if (!detection) {
        console.log("TinyFaceDetector failed, trying SSD MobileNet...");
        const ssdOptions = new faceapi.SsdMobilenetv1Options({
          minConfidence: 0.3
        });
        detection = await faceapi
          .detectSingleFace(img, ssdOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (!detection) {
        toast.error("No face detected in the image. Please ensure the face is clearly visible and try again.");
        setIsLoading(false);
        return;
      }

      // Get all face encodings from database
      const encodingsResponse = await faceRecognitionApi.getAllEncodings();
      if (!encodingsResponse.success || !encodingsResponse.data) {
        toast.error("Failed to fetch face data");
        setIsLoading(false);
        return;
      }

      const encodings = encodingsResponse.data;
      let bestMatch: { studentId: string; distance: number } | null = null;

      // Compare with all stored encodings
      for (const encoding of encodings) {
        // Validate encoding data
        if (!encoding.face_encoding || !Array.isArray(encoding.face_encoding)) {
          console.warn(`Invalid encoding for student ${encoding.id}`);
          continue;
        }
        
        const storedDescriptor = new Float32Array(encoding.face_encoding);
        
        // Ensure both descriptors have the same length (128)
        if (storedDescriptor.length !== detection.descriptor.length) {
          console.warn(`Descriptor length mismatch for student ${encoding.id}: stored=${storedDescriptor.length}, detected=${detection.descriptor.length}`);
          continue;
        }
        
        const distance = faceapi.euclideanDistance(
          detection.descriptor,
          storedDescriptor
        );

        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = { studentId: encoding.id, distance };
        }
      }

      // Threshold for match (0.6 is a common threshold)
      if (bestMatch && bestMatch.distance < 0.6) {
        // Fetch student details
        const studentResponse = await studentsApi.getById(bestMatch.studentId);
        if (studentResponse.success && studentResponse.data) {
          setMatchedStudent(studentResponse.data);
          setConfidence(Math.round((1 - bestMatch.distance) * 100));
          toast.success("Student identified successfully!");
        }
      } else {
        toast.info("No matching student found in the database");
      }
    } catch (error) {
      console.error("Face recognition error:", error);
      toast.error("Face recognition failed. Please try again.");
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
    } catch (error) {
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
    setMatchedStudent(null);
    setConfidence(0);
    setSearchResults([]);
    setRollNumber("");
    setSearchName("");
    setSelectedDepartment("");
    setSelectedClass("");
    setSelectedYear("");
    stopCamera();
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
        description="Identify students using facial recognition or search manually"
      />

      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Search Methods */}
          <div className="space-y-6">
            {/* Mode Toggle */}
            <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
              <button
                onClick={() => {
                  setSearchMode("face");
                  resetSearch();
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === "face"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <ScanFace className="h-4 w-4" />
                Face Recognition
              </button>
              <button
                onClick={() => {
                  setSearchMode("manual");
                  resetSearch();
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === "manual"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
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
                  {/* Face API Status */}
                  {!faceApiLoaded && !faceApiError && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            Loading face recognition models...
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {faceApiError && (
                    <Card className="border-red-200 dark:border-red-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                          <AlertCircle className="h-5 w-5" />
                          <span className="text-sm">{faceApiError}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Camera/Upload Area */}
                  <Card>
                    <CardContent className="p-6">
                      {!capturedImage ? (
                        <div className="space-y-4">
                          {/* Camera Preview */}
                          {isCameraActive ? (
                            <div className="relative">
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full rounded-xl bg-zinc-900"
                              />
                              <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded-xl pointer-events-none">
                                <div className="absolute inset-[20%] border-2 border-blue-400 rounded-lg" />
                              </div>
                              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                <Button
                                  size="lg"
                                  onClick={captureImage}
                                  className="shadow-lg"
                                >
                                  <Camera className="h-5 w-5" />
                                  Capture
                                </Button>
                                <Button
                                  size="lg"
                                  variant="outline"
                                  onClick={stopCamera}
                                  className="bg-white/90 dark:bg-zinc-900/90"
                                >
                                  <X className="h-5 w-5" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12">
                              <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                                <ScanFace className="h-8 w-8 text-blue-500" />
                              </div>
                              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                                Face Recognition
                              </h3>
                              <p className="text-sm text-zinc-500 text-center max-w-sm mb-6">
                                Use your camera to capture a face or upload an
                                image to identify a student
                              </p>
                              <div className="flex gap-4">
                                <Button
                                  onClick={startCamera}
                                  disabled={!faceApiLoaded}
                                >
                                  <Camera className="h-4 w-4" />
                                  Use Camera
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={!faceApiLoaded}
                                >
                                  <Upload className="h-4 w-4" />
                                  Upload Image
                                </Button>
                              </div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <img
                              src={capturedImage}
                              alt="Captured"
                              className="w-full rounded-xl"
                            />
                            {isLoading && (
                              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                <div className="text-center text-white">
                                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                                  <p className="text-sm">Analyzing face...</p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-4">
                            <Button
                              variant="outline"
                              onClick={resetSearch}
                              className="flex-1"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Try Again
                            </Button>
                            <Button
                              onClick={() => recognizeFace(capturedImage)}
                              className="flex-1"
                              disabled={isLoading}
                            >
                              <ScanFace className="h-4 w-4" />
                              Re-analyze
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Hidden canvas for capture */}
                  <canvas ref={canvasRef} className="hidden" />
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
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleRollNumberSearch()
                            }
                          />
                        </div>
                        <Button
                          onClick={handleRollNumberSearch}
                          disabled={isLoading}
                        >
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
                        icon={<Search className="h-4 w-4" />}
                        value={searchName}
                        onChange={(e) => {
                          setSearchName(e.target.value);
                          debouncedNameSearch(
                            e.target.value,
                            selectedDepartment,
                            selectedYear
                          );
                        }}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Select
                          label="Department"
                          placeholder="All departments"
                          options={[
                            { value: "", label: "All departments" },
                            ...departments.map((d) => ({
                              value: d.id,
                              label: d.code,
                            })),
                          ]}
                          value={selectedDepartment}
                          onChange={(e) => {
                            setSelectedDepartment(e.target.value);
                            debouncedNameSearch(
                              searchName,
                              e.target.value,
                              selectedYear
                            );
                          }}
                        />
                        <Select
                          label="Year"
                          placeholder="All years"
                          options={[{ value: "", label: "All years" }, ...years]}
                          value={selectedYear}
                          onChange={(e) => {
                            setSelectedYear(e.target.value);
                            debouncedNameSearch(
                              searchName,
                              selectedDepartment,
                              e.target.value
                            );
                          }}
                        />
                      </div>
                      <Select
                        label="Class"
                        placeholder="All classes"
                        options={[
                          { value: "", label: "All classes" },
                          ...classes
                            .filter(
                              (c) =>
                                !selectedDepartment ||
                                c.department_id === selectedDepartment
                            )
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
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            onClick={() => {
                              setMatchedStudent(student);
                              setSearchResults([]);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={student.image_url || student.profile_image_url}
                                alt={student.name}
                                fallback={student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                size="md"
                              />
                              <div>
                                <p className="font-medium text-zinc-900 dark:text-white">
                                  {student.name}
                                </p>
                                <p className="text-sm text-zinc-500">
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
                    <Spinner size="lg" />
                    <p className="text-sm text-zinc-500 mt-4">
                      Processing image...
                    </p>
                  </div>
                ) : matchedStudent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    {/* Match confidence */}
                    {confidence > 0 && (
                      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-emerald-500" />
                          <span className="font-medium text-emerald-700 dark:text-emerald-300">
                            Match Found
                          </span>
                        </div>
                        <Badge variant="success">{confidence}% confidence</Badge>
                      </div>
                    )}

                    {/* Student Photo */}
                    <div className="flex justify-center">
                      <div className="relative">
                        <Avatar
                          src={matchedStudent.image_url || matchedStudent.profile_image_url}
                          alt={matchedStudent.name}
                          fallback={matchedStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          size="xl"
                          className="w-32 h-32"
                        />
                        <div className="absolute -bottom-2 -right-2 p-2 bg-emerald-500 rounded-full">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Student Info */}
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                        {matchedStudent.name}
                      </h3>
                      <p className="text-zinc-500 mt-1">
                        Roll Number: {matchedStudent.roll_number}
                      </p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Department
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          {matchedStudent.departments?.name || "N/A"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Year
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          {matchedStudent.year}
                          {matchedStudent.year === 1
                            ? "st"
                            : matchedStudent.year === 2
                              ? "nd"
                              : matchedStudent.year === 3
                                ? "rd"
                                : "th"}{" "}
                          Year
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Email
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1 truncate">
                          {matchedStudent.email}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Class
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          {matchedStudent.classes?.name || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Phone */}
                    {matchedStudent.phone && (
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          Phone
                        </p>
                        <p className="font-medium text-zinc-900 dark:text-white mt-1">
                          {matchedStudent.phone}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4 pt-4">
                      <Button
                        variant="outline"
                        onClick={resetSearch}
                        className="flex-1"
                      >
                        <RefreshCw className="h-4 w-4" />
                        New Search
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => {
                          // Could open student profile in new tab or modal
                          window.open(
                            `/dashboard/students?id=${matchedStudent.id}`,
                            "_blank"
                          );
                        }}
                      >
                        <User className="h-4 w-4" />
                        View Profile
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                      <User className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                      No Student Selected
                    </h3>
                    <p className="text-sm text-zinc-500 text-center max-w-sm">
                      {searchMode === "face"
                        ? "Capture or upload an image to identify a student using face recognition"
                        : "Search for a student using roll number, name, or other filters"}
                    </p>
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
