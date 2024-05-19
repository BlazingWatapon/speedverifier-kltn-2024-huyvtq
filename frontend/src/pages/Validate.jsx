import React, { useState, useRef } from "react";
import Header from "../components/Header";
import "./Validate.css";
import PieChart from "../components/PieChart";
import axios from "axios";
import { saveAs } from "file-saver";

function Validate({ userId }) {
  const [files, setFiles] = useState([]);
  const [emailCount, setEmailCount] = useState(0);
  const [chartData, setChartData] = useState({
    labels: ["Valid", "Not Existed", "Block", "Full", "Syntax Error", "Unknown"],
    datasets: [
      {
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: ["#41B06E", "#526D82", "#D21312", "#FFD700", "#6962AD", "#213547"],
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  });

  const onFileChange = async (event) => {
    const newFiles = event.target.files;
    if (newFiles.length > 0) {
      const file = newFiles[0];
      setFiles([file]);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      try {
        const response = await axios.post("http://localhost:5000/api/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const { emailCount, percentages, zipFilePath } = response.data;

        setEmailCount(emailCount);

        setChartData((prevState) => ({
          ...prevState,
          datasets: [
            {
              ...prevState.datasets[0],
              data: percentages,
            },
          ],
        }));

        const zipResponse = await axios.get(`http://localhost:5000${zipFilePath}`, {
          responseType: 'blob',
        });

        const zipBlob = new Blob([zipResponse.data], { type: "application/zip" });
        saveAs(zipBlob, "validation_results.zip");
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  const fileInputRef = useRef();

  const handleClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="validate-content">
      <Header title="Validate" />
      <div className="validate-boxes">
        <div className="validate-statistic-box">
          <div className="status-statistic-box">
            <div className="list-piechart">
              <div className="validate-piechart">
                <PieChart data={chartData} />
              </div>
              <div className="list-total-email">
                <div className="validate-filename">{files.length > 0 ? files[0].name : "No file selected"}</div>
                <div className="list-total-email-line">Total email:</div>
                <div className="number-total-email">{emailCount}</div>
              </div>
            </div>
            <div className="list-statistics">
              <div className="list-overview-display">
                <div className="list-statistics-display">
                  <div className="list-status-item">
                    <div className="list-status-line">STATUS</div>
                    <div className="list-percent-line">% OF EMAILS</div>
                  </div>
                  {chartData.labels.map((label, index) => (
                    <div className="list-status-item" key={index}>
                      <div className="list-status-text">{label}</div>
                      <div className={`percent-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                        {chartData.datasets[0].data[index]}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="upload-list-box">
          <button className="upload-new-list-button" onClick={handleClick}>
            Validate New List
          </button>
          <input
            type="file"
            accept=".txt"
            onChange={onFileChange}
            ref={fileInputRef}
            className="file-upload"
            style={{ display: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

export default Validate;
