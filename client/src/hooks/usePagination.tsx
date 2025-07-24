import { useState, useMemo } from "react";

interface UsePaginationProps {
  data: any[];
  itemsPerPage: number;
  searchTerm?: string;
  searchFields?: string[];
}

export function usePagination({
  data,
  itemsPerPage,
  searchTerm = "",
  searchFields = [],
}: UsePaginationProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm || searchFields.length === 0) {
      return data;
    }

    return data.filter((item) => {
      return searchFields.some((field) => {
        const value = getNestedValue(item, field);
        return value
          ?.toString()
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, searchFields]);

  // Calculate pagination values
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Reset to first page when search term changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    startIndex: startIndex + 1, // 1-based indexing for display
    endIndex,
    paginatedData,
    filteredData,
  };
}

// Helper function to get nested object values using dot notation
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}
