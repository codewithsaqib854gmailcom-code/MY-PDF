		const libraryDefinitions = {
			pdfLib: { global: "PDFLib", src: "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js", label: "PDF" },
			pdfjs: { global: "pdfjsLib", src: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", label: "PDF text and image" },
			jszip: { global: "JSZip", src: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", label: "ZIP" },
			docx: { global: "docx", src: "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js", label: "Word" },
			xlsx: { global: "XLSX", src: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", label: "Excel" }
		};
		const libraryPromises = new Map();
		function loadLibrary(name) {
			const definition = libraryDefinitions[name], loadedLibrary = window[definition.global];
			if (loadedLibrary) return Promise.resolve(loadedLibrary);
			if (libraryPromises.has(name)) return libraryPromises.get(name);
			const promise = new Promise((resolve, reject) => {
				const script = document.createElement("script");
				script.src = definition.src;
				script.async = true;
				script.addEventListener("load", () => {
					const library = window[definition.global];
					if (!library) {
						libraryPromises.delete(name);
						reject(new Error(`${definition.label} tools failed to initialize. Reload the page and try again.`));
						return;
					}
					resolve(library);
				}, { once: true });
				script.addEventListener("error", () => {
					libraryPromises.delete(name);
					reject(new Error(`${definition.label} tools could not load. Check your internet connection and try again.`));
				}, { once: true });
				document.head.appendChild(script);
			});
			libraryPromises.set(name, promise);
			return promise;
		}
		const toolDetails = {
			merge: { title: "Merge PDF files", desc: "Select two or more PDFs. They will be combined in the order shown.", accept: ".pdf,application/pdf", multiple: true, button: "Merge PDFs" },
			split: { title: "Split a PDF", desc: "Choose a PDF and enter the page numbers or ranges to keep.", accept: ".pdf,application/pdf", multiple: false, button: "Create PDF", option: '<label for="page-range">Pages to keep</label><input id="page-range" type="text" placeholder="Example: 1-3, 5" inputmode="text"><div class="format-hint">Use commas for separate pages and hyphens for ranges.</div>' },
			compress: { title: "Compress a PDF", desc: "Re-save your PDF with optimized document structure. Scanned images may not shrink much.", accept: ".pdf,application/pdf", multiple: false, button: "Optimize PDF" },
			pdfjpg: { title: "Convert PDF to JPG", desc: "Each page becomes a JPG image. Your images will download together as a ZIP.", accept: ".pdf,application/pdf", multiple: false, button: "Convert to JPG" },
			jpgpdf: { title: "Convert JPG to PDF", desc: "Select one or more JPG images to create a PDF. Images are placed in file order.", accept: ".jpg,.jpeg,image/jpeg", multiple: true, button: "Create PDF" },
			pdfword: { title: "Convert PDF to Word", desc: "Extract selectable text into an editable DOCX. Scanned pages need OCR and are not supported.", accept: ".pdf,application/pdf", multiple: false, button: "Create Word file" },
			pdfexcel: { title: "Convert PDF to Excel", desc: "Extract selectable text into an XLSX spreadsheet. Scanned PDFs need OCR, and complex tables may need cleanup.", accept: ".pdf,application/pdf", multiple: false, button: "Create Excel file" },
			exceltopdf: { title: "Convert Excel to PDF", desc: "Convert each worksheet to landscape PDF pages. Long cell values may be clipped.", accept: ".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel", multiple: false, button: "Create PDF" }
		};
		const modal = document.getElementById("tool-modal"), input = document.getElementById("file-input"), fileList = document.getElementById("file-list"), processButton = document.getElementById("process-btn"), statusBox = document.getElementById("status");
		let activeTool = "", selectedFiles = [], modalOpener = null, pageRegionState = [];
		document.querySelectorAll("[data-tool]").forEach(card => card.addEventListener("click", () => openTool(card.dataset.tool)));
		document.getElementById("close-modal").addEventListener("click", closeModal);
		modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
		document.addEventListener("keydown", event => {
			if (!modal.classList.contains("open")) return;
			if (event.key === "Escape") {
				closeModal();
				return;
			}
			if (event.key !== "Tab") return;
			const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length);
			if (!focusable.length) {
				event.preventDefault();
				return;
			}
			const first = focusable[0], last = focusable[focusable.length - 1];
			if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
				event.preventDefault();
				first.focus();
			}
		});
		input.addEventListener("change", () => setFiles(Array.from(input.files || [])));
		processButton.addEventListener("click", processFiles);
		const dropzone = document.getElementById("dropzone");
		dropzone.addEventListener("dragover", event => { event.preventDefault(); dropzone.classList.add("dragover"); });
		dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
		dropzone.addEventListener("drop", event => { event.preventDefault(); dropzone.classList.remove("dragover"); setFiles(Array.from(event.dataTransfer.files || [])); });
		function openTool(name) {
			activeTool = name;
			modalOpener = document.activeElement;
			pageRegionState = Array.from(document.querySelectorAll("body > header, body > main, body > footer")).map(element => ({
				element,
				ariaHidden: element.getAttribute("aria-hidden"),
				inert: element.hasAttribute("inert")
			}));
			pageRegionState.forEach(({ element }) => {
				element.setAttribute("inert", "");
				element.setAttribute("aria-hidden", "true");
			});
			const details = toolDetails[name];
			selectedFiles = [];
			document.getElementById("modal-title").textContent = details.title;
			document.getElementById("modal-desc").textContent = details.desc;
			document.getElementById("file-types").textContent = name === "jpgpdf" ? "JPG or JPEG images" : name === "exceltopdf" ? "Excel workbooks (.xlsx, .xls, .xlsm)" : "PDF files";
			document.getElementById("options").innerHTML = details.option || "";
			input.accept = details.accept;
			input.multiple = details.multiple;
			input.value = "";
			fileList.innerHTML = "";
			statusBox.textContent = "";
			statusBox.classList.remove("error");
			processButton.textContent = "Choose files first";
			processButton.disabled = true;
			modal.classList.add("open");
			document.getElementById("close-modal").focus();
		}
		function closeModal() {
			if (!modal.classList.contains("open")) return;
			modal.classList.remove("open");
			pageRegionState.forEach(({ element, ariaHidden, inert }) => {
				if (ariaHidden === null) element.removeAttribute("aria-hidden");
				else element.setAttribute("aria-hidden", ariaHidden);
				if (inert) element.setAttribute("inert", "");
				else element.removeAttribute("inert");
			});
			pageRegionState = [];
			if (modalOpener && modalOpener.isConnected) modalOpener.focus();
			modalOpener = null;
		}
		function setFiles(files) { const isJpg = activeTool === "jpgpdf", isExcel = activeTool === "exceltopdf"; selectedFiles = files.filter(file => isJpg ? /^image\/jpeg$/i.test(file.type) || /\.jpe?g$/i.test(file.name) : isExcel ? /\.(xlsx|xls|xlsm)$/i.test(file.name) : file.type === "application/pdf" || /\.pdf$/i.test(file.name)); fileList.innerHTML = selectedFiles.map(file => `<li>${escapeHtml(file.name)} <span style="color:#59666c">· ${formatSize(file.size)}</span></li>`).join(""); const valid = isJpg ? selectedFiles.length > 0 : (activeTool === "merge" ? selectedFiles.length > 1 : selectedFiles.length === 1); processButton.disabled = !valid; processButton.textContent = valid ? toolDetails[activeTool].button : "Choose files first"; statusBox.classList.remove("error"); statusBox.textContent = files.length && selectedFiles.length !== files.length ? "Some files were skipped because their format is not supported." : ""; }
		function escapeHtml(text) { return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
		function formatSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
		function setStatus(message, error = false) { statusBox.textContent = message; statusBox.classList.toggle("error", error); }
		function download(bytes, filename, type) { const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
		function safeBase(name) { return name.replace(/\.pdf$/i, "").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_"); }
		async function processFiles() { if (!selectedFiles.length) return; processButton.disabled = true; processButton.textContent = "Working..."; setStatus("Processing locally in your browser..."); try { if (activeTool === "merge") await mergePdfs(); if (activeTool === "split") await splitPdf(); if (activeTool === "compress") await compressPdf(); if (activeTool === "pdfjpg") await convertPdfToJpg(); if (activeTool === "jpgpdf") await convertJpgToPdf(); if (activeTool === "pdfword") await convertPdfToWord(); if (activeTool === "pdfexcel") await convertPdfToExcel(); if (activeTool === "exceltopdf") await convertExcelToPdf(); } catch (error) { console.error(error); setStatus(error && error.message ? error.message : "Something went wrong. Check that the selected file is valid and try again.", true); } finally { processButton.disabled = false; processButton.textContent = toolDetails[activeTool].button; } }
		async function requirePdfLib() { return loadLibrary("pdfLib"); }
		async function requirePdfJs() {
			const pdfjsLib = await loadLibrary("pdfjs");
			pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
			return pdfjsLib;
		}
		async function mergePdfs() { const { PDFDocument } = await requirePdfLib(); const merged = await PDFDocument.create(); for (const file of selectedFiles) { const source = await PDFDocument.load(await file.arrayBuffer()); const pages = await merged.copyPages(source, source.getPageIndices()); pages.forEach(page => merged.addPage(page)); } download(await merged.save(), "merged.pdf", "application/pdf"); setStatus("Done. Your merged PDF has been downloaded."); }
		async function splitPdf() { const { PDFDocument } = await requirePdfLib(); const range = document.getElementById("page-range").value.trim(); if (!range) throw new Error("Enter the page numbers or ranges you want to keep."); const source = await PDFDocument.load(await selectedFiles[0].arrayBuffer()); const pageIndexes = parsePageRange(range, source.getPageCount()); const output = await PDFDocument.create(); const pages = await output.copyPages(source, pageIndexes); pages.forEach(page => output.addPage(page)); download(await output.save(), `${safeBase(selectedFiles[0].name)}-split.pdf`, `application/pdf`); setStatus(`Done. ${pages.length} page${pages.length === 1 ? "" : "s"} saved to a new PDF.`); }
		function parsePageRange(value, total) { const pages = new Set(); for (const part of value.split(",")) { const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (!match) throw new Error("Use page numbers and ranges like 1-3, 5."); const start = Number(match[1]), end = Number(match[2] || match[1]); if (start < 1 || end < start || end > total) throw new Error(`Page numbers must be between 1 and ${total}.`); for (let page = start; page <= end; page++)pages.add(page - 1); } return [...pages].sort((a, b) => a - b); }
		async function compressPdf() { const { PDFDocument } = await requirePdfLib(); const source = await PDFDocument.load(await selectedFiles[0].arrayBuffer()); const output = await source.save({ useObjectStreams: true }); download(output, `${safeBase(selectedFiles[0].name)}-optimized.pdf`, `application/pdf`); setStatus(`Done. Re-saved at ${formatSize(new Blob([output]).size)} (original ${formatSize(selectedFiles[0].size)}). Image-heavy scans may not get smaller.`); }
		async function convertJpgToPdf() { const { PDFDocument } = await requirePdfLib(); const pdf = await PDFDocument.create(); for (const file of selectedFiles) { const image = await pdf.embedJpg(await file.arrayBuffer()); const page = pdf.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height }); } download(await pdf.save(), "images.pdf", "application/pdf"); setStatus("Done. Your images are now in a PDF."); }
		async function convertPdfToJpg() {
			const [pdfjsLib, JSZip] = await Promise.all([requirePdfJs(), loadLibrary("jszip")]);
			const pdf = await pdfjsLib.getDocument({ data: await selectedFiles[0].arrayBuffer() }).promise;
			const zip = new JSZip();
			for (let number = 1; number <= pdf.numPages; number++) {
				setStatus(`Converting page ${number} of ${pdf.numPages}...`);
				const page = await pdf.getPage(number), viewport = page.getViewport({ scale: 1.6 }), canvas = document.createElement("canvas");
				canvas.width = Math.ceil(viewport.width);
				canvas.height = Math.ceil(viewport.height);
				await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
				const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .88));
				if (!blob) throw new Error(`Could not render page ${number} as JPG.`);
				zip.file(`page-${String(number).padStart(3, "0")}.jpg`, blob);
				canvas.width = 0;
				canvas.height = 0;
			}
			download(await zip.generateAsync({ type: "blob" }), `${safeBase(selectedFiles[0].name)}-jpg.zip`, "application/zip");
			setStatus(`Done. ${pdf.numPages} JPG image${pdf.numPages === 1 ? "" : "s"} saved in a ZIP file.`);
		}
		async function convertPdfToWord() {
			const [pdfjsLib, docx] = await Promise.all([requirePdfJs(), loadLibrary("docx")]);
			const pdf = await pdfjsLib.getDocument({ data: await selectedFiles[0].arrayBuffer() }).promise, paragraphs = [];
			let extractedText = "";
			for (let number = 1; number <= pdf.numPages; number++) {
				setStatus(`Extracting text from page ${number} of ${pdf.numPages}...`);
				const page = await pdf.getPage(number), content = await page.getTextContent();
				let line = "";
				for (const item of content.items) {
					if (!item.str) continue;
					line += item.str;
					if (item.hasEOL) {
						if (line.trim()) {
							paragraphs.push(new docx.Paragraph(line.trim()));
							extractedText += line.trim();
						}
						line = "";
					} else line += " ";
				}
				if (line.trim()) {
					paragraphs.push(new docx.Paragraph(line.trim()));
					extractedText += line.trim();
				}
				if (number < pdf.numPages) paragraphs.push(new docx.Paragraph(""));
			}
			if (!extractedText.trim()) throw new Error("No selectable text found. Scanned PDFs need OCR before they can be converted.");
			const documentFile = new docx.Document({ sections: [{ children: paragraphs }] });
			download(await docx.Packer.toBlob(documentFile), `${safeBase(selectedFiles[0].name)}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
			setStatus("Done. Editable text has been saved as a Word document.");
		}
		async function requireXlsx() { return loadLibrary("xlsx"); }
		async function convertPdfToExcel() {
			const [XLSX, pdfjsLib] = await Promise.all([requireXlsx(), requirePdfJs()]);
			const pdf = await pdfjsLib.getDocument({ data: await selectedFiles[0].arrayBuffer() }).promise, workbook = XLSX.utils.book_new();
			let pagesWithText = 0;
			for (let number = 1; number <= pdf.numPages; number++) {
				setStatus(`Extracting text from page ${number} of ${pdf.numPages}...`);
				const page = await pdf.getPage(number), content = await page.getTextContent();
				const items = content.items.filter(item => typeof item.str === "string" && item.str.trim() && item.transform).map(item => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5], width: item.width || 0, size: Math.hypot(item.transform[2], item.transform[3]) || 10 })).sort((a, b) => b.y - a.y || a.x - b.x);
				const lines = [];
				for (const item of items) {
					let line = lines[lines.length - 1];
					if (!line || Math.abs(line.y - item.y) > Math.max(2, item.size * .35)) {
						line = { y: item.y, items: [] };
						lines.push(line);
					}
					line.items.push(item);
				}
				if (!lines.length) continue;
				const rows = lines.map(line => {
					line.items.sort((a, b) => a.x - b.x);
					const cells = [];
					let text = "", previous = null;
					for (const item of line.items) {
						const gap = previous ? item.x - (previous.x + previous.width) : 0;
						if (previous && gap > Math.max(18, previous.size * 1.5)) {
							cells.push(text.trim());
							text = item.text;
						} else {
							if (text && gap > 2) text += " ";
							text += item.text;
						}
						previous = item;
					}
					cells.push(text.trim());
					return cells;
				});
				XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `Page ${number}`);
				pagesWithText++;
			}
			if (!pagesWithText) throw new Error("No selectable text found. Scanned PDFs need OCR before they can be converted.");
			download(XLSX.write(workbook, { bookType: "xlsx", type: "array" }), `${safeBase(selectedFiles[0].name)}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
			setStatus(`Done. Extracted selectable text from ${pagesWithText} page${pagesWithText === 1 ? "" : "s"} into an Excel workbook.`);
		}
		async function convertExcelToPdf() {
			const XLSX = await requireXlsx(), { PDFDocument } = await requirePdfLib();
			const workbook = XLSX.read(await selectedFiles[0].arrayBuffer(), { type: "array" }), pdf = await PDFDocument.create();
			const pageWidth = 1122, pageHeight = 794, margin = 36, rowHeight = 30, pageRows = Math.floor((pageHeight - margin * 2 - 42) / rowHeight);
			let pageCount = 0, sheetCount = 0;
			for (const sheetName of workbook.SheetNames) {
				const sheet = workbook.Sheets[sheetName], rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
				if (!rows.length) continue;
				const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
				if (!columnCount) continue;
				const widths = Array.from({ length: columnCount }, (_, column) => {
					const longest = rows.slice(0, 1000).reduce((max, row) => Math.max(max, String(row[column] == null ? "" : row[column]).length), 8);
					return Math.min(34, longest) * 7 + 18;
				});
				const columnGroups = [];
				let group = [], groupWidth = 0;
				widths.forEach((width, column) => {
					if (group.length && groupWidth + width > pageWidth - margin * 2) {
						columnGroups.push(group);
						group = [];
						groupWidth = 0;
					}
					group.push(column);
					groupWidth += width;
				});
				if (group.length) columnGroups.push(group);
				sheetCount++;
				for (const columns of columnGroups) {
					for (let rowStart = 0; rowStart < rows.length; rowStart += pageRows) {
						setStatus(`Preparing ${sheetName}, rows ${rowStart + 1}-${Math.min(rowStart + pageRows, rows.length)}...`);
						const canvas = document.createElement("canvas");
						canvas.width = pageWidth;
						canvas.height = pageHeight;
						const context = canvas.getContext("2d");
						context.fillStyle = "#fff";
						context.fillRect(0, 0, pageWidth, pageHeight);
						context.fillStyle = "#202a32";
						context.font = "bold 18px Arial, sans-serif";
						context.fillText(`${sheetName} - rows ${rowStart + 1}-${Math.min(rowStart + pageRows, rows.length)}`, margin, 28);
						let y = 48;
						let x = margin;
						for (const column of columns) {
							const width = widths[column];
							for (let offset = 0; offset < pageRows && rowStart + offset < rows.length; offset++) {
								const rowIndex = rowStart + offset, value = String(rows[rowIndex][column] == null ? "" : rows[rowIndex][column]);
								const cellY = y + offset * rowHeight;
								context.fillStyle = rowIndex === 0 ? "#e4f0e9" : (offset % 2 ? "#f7f9f7" : "#fff");
								context.fillRect(x, cellY, width, rowHeight);
								context.strokeStyle = "#dce3dd";
								context.strokeRect(x, cellY, width, rowHeight);
								context.fillStyle = "#202a32";
								context.font = `${rowIndex === 0 ? "bold " : ""}12px Arial, sans-serif`;
								context.save();
								context.beginPath();
								context.rect(x + 5, cellY + 2, width - 10, rowHeight - 4);
								context.clip();
								context.fillText(value, x + 5, cellY + 19);
								context.restore();
							}
							x += width;
						}
						const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
						if (!imageBlob) throw new Error(`Could not render worksheet "${sheetName}" as PDF.`);
						const image = await pdf.embedPng(await imageBlob.arrayBuffer());
						pdf.addPage([841.89, 595.28]).drawImage(image, { x: 0, y: 0, width: 841.89, height: 595.28 });
						pageCount++;
					}
				}
			}
			if (!pageCount) throw new Error("This workbook has no worksheet data to convert.");
			download(await pdf.save(), `${safeBase(selectedFiles[0].name)}.pdf`, "application/pdf");
			setStatus(`Done. Exported ${sheetCount} worksheet${sheetCount === 1 ? "" : "s"} across ${pageCount} PDF page${pageCount === 1 ? "" : "s"}.`);
		}