import API_URL from '../../config';
import React, { useEffect, useState } from "react";
import axios from "axios";

const StudentTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data } = await axios.get(
          `${API_URL}/api/students/getStudentTasks`,
          { withCredentials: true }
        );
        if (data.success) {
          setTasks(data.tasks);
          setFilteredTasks(data.tasks);
        } else {
          setError("Failed to load tasks.");
        }
      } catch (err) {
        console.error(err);
        setError("An error occurred while fetching tasks.");
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearch(value);
    setFilteredTasks(
      tasks.filter(
        (task) =>
          task.courseName.toLowerCase().includes(value) ||
          task.facultyName.toLowerCase().includes(value)
      )
    );
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Loading tasks...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!tasks || tasks.length === 0)
    return <div className="text-center py-10 text-gray-500">No tasks available.</div>;

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Tasks</h2>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search by course or faculty..."
          className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="space-y-2">
        {filteredTasks.length === 0 && (
          <div className="text-gray-500 py-4 text-center">No tasks match your search.</div>
        )}
        {filteredTasks.map((task) => (
          <details
            key={task._id}
            className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <summary className="cursor-pointer p-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{task.taskTitle}</h3>
                <p className="text-sm text-gray-500">
                  {task.courseName} ({task.courseCode}) • {task.facultyName} • Semester {task.semester}
                </p>
              </div>
            </summary>

            <div className="p-4 bg-white border-t border-gray-200">
              <p className="text-gray-700 text-sm mb-2">
                <span className="font-semibold">Batch & Section:</span> {task.batchName} - {task.sectionName}
              </p>
              <p className="text-gray-700 text-sm mb-3">
                <span className="font-semibold">Description:</span> {task.taskDescription}
              </p>

              {task.assignmentFile && (
                <a
                  href={`${API_URL}/api/students/taskfile/${task.assignmentFile}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm mb-2 inline-block"
                >
                  View Assignment: {task.assignmentFile.split("-").pop()}
                </a>
              )}

              <p className="text-gray-400 text-xs mt-2">
                Created on: {new Date(task.createdAt).toLocaleDateString()} {new Date(task.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export default StudentTasks;
