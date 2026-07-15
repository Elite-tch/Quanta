"use client";

import { useState } from "react";

interface SecurityLevel {
  id: number;
  name: string;
  description: string;
  category: "classical" | "hybrid" | "post_quantum" | "reserved";
  quantumBits: number;
  recommended: boolean;
}

const SECURITY_LEVELS: SecurityLevel[] = [
  {
    id: 1,
    name: "ECDSA-128",
    description: "Classical elliptic curve, 128-bit equivalent",
    category: "classical",
    quantumBits: 50,
    recommended: false
  },
  {
    id: 2,
    name: "ECDSA-192",
    description: "Classical elliptic curve, 192-bit equivalent",
    category: "classical",
    quantumBits: 75,
    recommended: false
  },
  {
    id: 3,
    name: "Ed25519",
    description: "Edwards curve signature scheme",
    category: "classical",
    quantumBits: 100,
    recommended: false
  },
  {
    id: 4,
    name: "ECDSA+RSA-2048",
    description: "Hybrid classical approach",
    category: "classical",
    quantumBits: 112,
    recommended: false
  },
  {
    id: 5,
    name: "ECDSA+RSA-4096",
    description: "Strong classical hybrid",
    category: "classical",
    quantumBits: 128,
    recommended: true
  },
  {
    id: 6,
    name: "Dilithium2+ECDSA",
    description: "Post-quantum hybrid scheme",
    category: "hybrid",
    quantumBits: 150,
    recommended: false
  },
  {
    id: 7,
    name: "Dilithium2+P256",
    description: "Hybrid with P256",
    category: "hybrid",
    quantumBits: 150,
    recommended: false
  },
  {
    id: 12,
    name: "SPHINCS+-128f",
    description: "Stateless hash-based signature",
    category: "post_quantum",
    quantumBits: 200,
    recommended: false
  },
  {
    id: 14,
    name: "SPHINCS+-256f",
    description: "Maximum security variant",
    category: "post_quantum",
    quantumBits: 256,
    recommended: false
  },
  {
    id: 15,
    name: "Dilithium5+Falcon-1024",
    description: "Highest quantum resistance",
    category: "post_quantum",
    quantumBits: 300,
    recommended: false
  }
];

interface SecurityLevelsProps {
  currentLevel: number;
  onSelectLevel: (level: number) => void;
  onClose: () => void;
}

export default function SecurityLevels({
  currentLevel,
  onSelectLevel,
  onClose
}: SecurityLevelsProps) {
  const [selectedCategory, setSelectedCategory] = useState<"classical" | "hybrid" | "post_quantum" | "reserved">("classical");

  const filteredLevels = SECURITY_LEVELS.filter(level => level.category === selectedCategory);

  const getCategoryInfo = (category: string) => {
    switch (category) {
      case "classical":
        return {
          title: "Classical (Levels 1-5)",
          description: "Traditional cryptography. Suitable for testnet and non-critical use."
        };
      case "hybrid":
        return {
          title: "Hybrid (Levels 6-11)",
          description: "Combines classical and post-quantum algorithms for stronger security."
        };
      case "post_quantum":
        return {
          title: "Post-Quantum (Levels 12-20)",
          description: "Quantum-resistant algorithms. Recommended for high-security applications."
        };
      default:
        return { title: "Category", description: "" };
    }
  };

  const categoryInfo = getCategoryInfo(selectedCategory);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="rounded-3xl border border-white/10 bg-[#05070b] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-[#05070b]/95 backdrop-blur">
          <h2 className="text-xl font-bold">Security Levels</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            {["classical", "hybrid", "post_quantum"].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  selectedCategory === category
                    ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                {category === "classical" ? "Classical" : category === "hybrid" ? "Hybrid" : "Post-Quantum"}
              </button>
            ))}
          </div>

          {/* Category Info */}
          <div className="rounded-lg bg-white/5 border border-white/10 p-4">
            <h3 className="font-semibold text-sm mb-1">{categoryInfo.title}</h3>
            <p className="text-xs text-white/60">{categoryInfo.description}</p>
          </div>

          {/* Levels Grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredLevels.map((level) => (
              <button
                key={level.id}
                onClick={() => {
                  onSelectLevel(level.id);
                  onClose();
                }}
                className={`text-left rounded-lg border transition-all p-4 group ${
                  currentLevel === level.id
                    ? "border-[#00d4aa] bg-[#00d4aa]/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Level {level.id}</span>
                    {level.recommended && (
                      <span className="text-xs bg-[#00d4aa]/20 text-[#00d4aa] px-2 py-0.5 rounded">Recommended</span>
                    )}
                    {currentLevel === level.id && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Active</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60 font-mono">{level.quantumBits} bits</div>
                  </div>
                </div>
                <p className="text-xs text-white/70 mb-2">{level.name}</p>
                <p className="text-xs text-white/50">{level.description}</p>
              </button>
            ))}
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60 space-y-2">
              <p>
                <strong>Classical:</strong> Traditional cryptography suitable for most testnet use cases.
              </p>
              <p>
                <strong>Hybrid:</strong> Combines classical and post-quantum algorithms for enhanced security.
              </p>
              <p>
                <strong>Post-Quantum:</strong> Quantum-resistant algorithms recommended for long-term security.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
